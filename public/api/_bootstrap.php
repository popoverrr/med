<?php
/**
 * Общий каркас для эндпоинтов форм (ТЗ §10): только POST + JSON, проверка Origin, honeypot,
 * проверка времени заполнения, файловый rate-limit по IP, ответ JSON, отправка e-mail (PHPMailer, SMTP)
 * и уведомления в Telegram Bot API. Ничего не пишет в публичные директории (data_dir вне httpdocs).
 * PHP 8.1+.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: strict-origin-when-cross-origin');

const HM_VERSION = '1.0.0';

function hm_respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function hm_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $file = __DIR__ . '/config.php';
    if (!is_file($file)) {
        hm_respond(500, ['ok' => false, 'error' => 'not_configured']);
    }
    $config = require $file;
    return $config;
}

/** Каталог для журнала и rate-limit. По умолчанию api/_data (закрыт .htaccess). */
function hm_data_dir(): string
{
    $cfg = hm_config();
    $dir = $cfg['data_dir'] ?? null;
    if (!$dir) {
        $dir = __DIR__ . '/_data';
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        @file_put_contents($dir . '/index.html', '');
    }
    return rtrim($dir, '/');
}

function hm_client_ip(): string
{
    // За прокси Plesk обычно REMOTE_ADDR корректен; X-Forwarded-For не доверяем без настройки.
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/** Только POST. */
function hm_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        hm_respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
    }
}

/** Проверка Origin (и Referer как запасной вариант). */
function hm_check_origin(): void
{
    $cfg = hm_config();
    $allowed = $cfg['allowed_origins'] ?? [];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' && !empty($_SERVER['HTTP_REFERER'])) {
        $p = parse_url($_SERVER['HTTP_REFERER']);
        if ($p && isset($p['scheme'], $p['host'])) {
            $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        }
    }
    // Локальная разработка: разрешаем localhost без конфигурации
    $isLocal = preg_match('~^https?://(localhost|127\.0\.0\.1)(:\d+)?$~', $origin) === 1;
    if (!$isLocal && !in_array($origin, $allowed, true)) {
        hm_respond(403, ['ok' => false, 'error' => 'origin']);
    }
}

/** Читает JSON-тело (или form-data как запасной вариант). */
function hm_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($ct, 'application/json')) {
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            hm_respond(400, ['ok' => false, 'error' => 'bad_json']);
        }
        return $data;
    }
    return $_POST;
}

/** Файловый rate-limit: max запросов за window секунд с одного IP. */
function hm_rate_limit(string $bucket): void
{
    $cfg = hm_config();
    $max = (int)($cfg['rate_limit']['max'] ?? 5);
    $window = (int)($cfg['rate_limit']['window'] ?? 600);
    $ip = hm_client_ip();
    $file = hm_data_dir() . '/rl_' . $bucket . '_' . hash('sha256', $ip) . '.json';
    $now = time();
    $fh = fopen($file, 'c+');
    if (!$fh) {
        return; // не блокируем пользователя из-за проблем с ФС
    }
    flock($fh, LOCK_EX);
    $content = stream_get_contents($fh) ?: '[]';
    $hits = json_decode($content, true);
    if (!is_array($hits)) {
        $hits = [];
    }
    $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $window));
    if (count($hits) >= $max) {
        flock($fh, LOCK_UN);
        fclose($fh);
        header('Retry-After: ' . $window);
        hm_respond(429, ['ok' => false, 'error' => 'rate_limit']);
    }
    $hits[] = $now;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($hits));
    flock($fh, LOCK_UN);
    fclose($fh);
}

/** Honeypot + время заполнения. Ботам отвечаем «ok», чтобы не подсказывать. */
function hm_antispam(array $in): void
{
    $cfg = hm_config();
    $honeypot = trim((string)($in['website'] ?? ''));
    $elapsed = (int)($in['elapsed'] ?? 0);
    $min = (int)($cfg['min_fill_seconds'] ?? 3) * 1000;
    if ($honeypot !== '' || $elapsed < $min) {
        hm_respond(200, ['ok' => true]);
    }
}

function hm_clean(string $value, int $max): string
{
    $value = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '');
    return mb_substr($value, 0, $max);
}

function hm_valid_phone(string $phone): bool
{
    return preg_match('/^\+7 \d{3} \d{3} \d{2} \d{2}$/', $phone) === 1;
}

function hm_esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Журнал заявок (минимальный набор данных) + ротация по сроку хранения. */
function hm_log(string $form, array $record): void
{
    $cfg = hm_config();
    if (!($cfg['log_requests'] ?? true)) {
        return;
    }
    $dir = hm_data_dir();
    $file = $dir . '/requests.jsonl';
    $record['ts'] = date('c');
    $record['form'] = $form;
    $record['ip_hash'] = substr(hash('sha256', hm_client_ip() . date('Y-m')), 0, 16); // IP не храним в открытом виде
    @file_put_contents($file, json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

    // Ротация: раз в день удаляем записи старше retention
    $marker = $dir . '/.rotated';
    if (!is_file($marker) || filemtime($marker) < time() - 86400) {
        @touch($marker);
        $days = (int)($cfg['log_retention_days'] ?? 365);
        $cutoff = time() - $days * 86400;
        if (is_file($file)) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            $keep = array_filter($lines, static function ($line) use ($cutoff) {
                $r = json_decode($line, true);
                return is_array($r) && isset($r['ts']) && strtotime($r['ts']) >= $cutoff;
            });
            @file_put_contents($file, implode("\n", $keep) . (count($keep) ? "\n" : ''), LOCK_EX);
        }
    }
}

/** Письмо через PHPMailer (SMTP). Возвращает true при успехе. */
function hm_send_mail(string $subject, string $html, string $text): bool
{
    $cfg = hm_config();
    $m = $cfg['mail'] ?? [];
    if (!($m['enabled'] ?? false)) {
        return false;
    }
    require_once __DIR__ . '/lib/PHPMailer/Exception.php';
    require_once __DIR__ . '/lib/PHPMailer/PHPMailer.php';
    require_once __DIR__ . '/lib/PHPMailer/SMTP.php';

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->CharSet = 'UTF-8';
        $mail->isSMTP();
        $mail->Host = $m['smtp']['host'] ?? 'localhost';
        $mail->Port = (int)($m['smtp']['port'] ?? 587);
        $secure = $m['smtp']['secure'] ?? 'tls';
        if ($secure !== '') {
            $mail->SMTPSecure = $secure;
        }
        $mail->SMTPAuth = !empty($m['smtp']['username']);
        if ($mail->SMTPAuth) {
            $mail->Username = $m['smtp']['username'];
            $mail->Password = $m['smtp']['password'] ?? '';
        }
        $mail->Timeout = 10;
        $mail->setFrom($m['from'], $m['from_name'] ?? 'Hydromed');
        foreach ((array)($m['to'] ?? []) as $to) {
            $mail->addAddress($to);
        }
        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body = $html;
        $mail->AltBody = $text;
        return $mail->send();
    } catch (Throwable $e) {
        error_log('[hydromed] mail error: ' . $e->getMessage());
        return false;
    }
}

/** Уведомление в Telegram Bot API. */
function hm_send_telegram(string $text): bool
{
    $cfg = hm_config();
    $t = $cfg['telegram'] ?? [];
    if (!($t['enabled'] ?? false) || empty($t['token']) || empty($t['chat_id'])) {
        return false;
    }
    $url = 'https://api.telegram.org/bot' . $t['token'] . '/sendMessage';
    $payload = http_build_query(['chat_id' => $t['chat_id'], 'text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true]);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
        $res = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $res !== false && $code === 200;
    }
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $payload, 'timeout' => 8]]);
    return @file_get_contents($url, false, $ctx) !== false;
}

/** Общая последовательность защиты для эндпоинта. Возвращает входные данные. */
function hm_guard(string $bucket): array
{
    hm_require_post();
    hm_check_origin();
    hm_rate_limit($bucket);
    $in = hm_input();
    hm_antispam($in);
    return $in;
}
