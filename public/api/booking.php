<?php
/**
 * POST /api/booking.php — заявка на запись. JSON in / JSON out.
 * Поля: name, phone (+7 XXX XXX XX XX), service, date (YYYY-MM-DD, опц.), time (morning|afternoon|evening), comment (опц.),
 *       consent (true), locale, website (honeypot), elapsed (мс).
 */
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$in = hm_guard('booking');

$locale = ($in['locale'] ?? 'ru') === 'kk' ? 'kk' : 'ru';
$name = hm_clean((string)($in['name'] ?? ''), 80);
$phone = hm_clean((string)($in['phone'] ?? ''), 20);
$service = hm_clean((string)($in['service'] ?? ''), 32);
$date = hm_clean((string)($in['date'] ?? ''), 10);
$time = hm_clean((string)($in['time'] ?? ''), 16);
$comment = hm_clean((string)($in['comment'] ?? ''), 1000);
$consent = ($in['consent'] ?? false) === true || ($in['consent'] ?? '') === 'true' || ($in['consent'] ?? '') === '1';
$page = hm_clean((string)($in['page'] ?? ''), 200);

$msg = $locale === 'kk'
    ? ['name' => 'Атыңызды көрсетіңіз (кемінде 2 таңба)', 'phone' => 'Телефонды +7 XXX XXX XX XX форматында көрсетіңіз', 'date' => 'Күн өткен уақытта болмауы керек', 'consent' => 'Деректерді өңдеуге келісімсіз өтінім жіберу мүмкін емес']
    : ['name' => 'Укажите имя (минимум 2 символа)', 'phone' => 'Укажите телефон в формате +7 XXX XXX XX XX', 'date' => 'Дата не может быть в прошлом', 'consent' => 'Без согласия на обработку данных отправить заявку нельзя'];

$errors = [];
if (mb_strlen($name) < 2) {
    $errors['name'] = $msg['name'];
}
if (!hm_valid_phone($phone)) {
    $errors['phone'] = $msg['phone'];
}
if ($date !== '') {
    $d = DateTime::createFromFormat('Y-m-d', $date);
    if (!$d || $d->format('Y-m-d') !== $date) {
        $errors['date'] = $msg['date'];
        $date = '';
    } elseif ($d < new DateTime('today')) {
        $errors['date'] = $msg['date'];
    }
}
if (!in_array($service, ['consultation', 'procedure', 'course'], true)) {
    $service = 'consultation';
}
if (!in_array($time, ['morning', 'afternoon', 'evening', ''], true)) {
    $time = '';
}
if (!$consent) {
    $errors['consent'] = $msg['consent'];
}
if ($errors) {
    hm_respond(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);
}

$serviceLabel = ['consultation' => 'Консультация', 'procedure' => 'Консультация и процедура', 'course' => 'Курс процедур'][$service];
$timeLabel = ['morning' => 'утро', 'afternoon' => 'день', 'evening' => 'вечер', '' => '—'][$time];

$lines = [
    'Имя: ' . $name,
    'Телефон: ' . $phone,
    'Услуга: ' . $serviceLabel,
    'Дата: ' . ($date !== '' ? $date : '—') . ', время: ' . $timeLabel,
    'Комментарий: ' . ($comment !== '' ? $comment : '—'),
    'Язык: ' . strtoupper($locale) . ', страница: ' . $page,
    'Согласие на ПДн: да, ' . date('d.m.Y H:i'),
];
$text = "Новая заявка на запись (Hydromed)\n" . implode("\n", $lines);
$html = '<h2 style="font-family:sans-serif">Новая заявка на запись — Hydromed</h2><table style="font-family:sans-serif;border-collapse:collapse">'
    . implode('', array_map(static fn($l) => '<tr><td style="padding:4px 12px 4px 0;color:#6e5f60">' . hm_esc(strtok($l, ':')) . '</td><td style="padding:4px 0">' . hm_esc(trim((string)strstr($l, ':'), ': ')) . '</td></tr>', $lines))
    . '</table>';

$mailOk = hm_send_mail('Заявка на запись: ' . $name . ', ' . $phone, $html, $text);
$tgOk = hm_send_telegram("📋 <b>Заявка на запись</b>\n" . hm_esc(implode("\n", $lines)));

hm_log('booking', [
    'name' => $name,
    'phone' => $phone,
    'service' => $service,
    'date' => $date,
    'time' => $time,
    'comment' => $comment,
    'locale' => $locale,
    'consent' => true,
    'consent_doc' => 'consent-v1',
    'delivered' => ['mail' => $mailOk, 'telegram' => $tgOk],
]);

hm_respond(200, ['ok' => true]);
