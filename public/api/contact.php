<?php
/**
 * POST /api/contact.php — вопрос через форму на странице контактов. JSON in / JSON out.
 * Поля: name, contact (телефон или e-mail), message, consent (true), locale, website (honeypot), elapsed (мс).
 */
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$in = hm_guard('contact');

$locale = ($in['locale'] ?? 'ru') === 'kk' ? 'kk' : 'ru';
$name = hm_clean((string)($in['name'] ?? ''), 80);
$contact = hm_clean((string)($in['contact'] ?? ''), 120);
$message = hm_clean((string)($in['message'] ?? ''), 2000);
$consent = ($in['consent'] ?? false) === true || ($in['consent'] ?? '') === 'true' || ($in['consent'] ?? '') === '1';
$page = hm_clean((string)($in['page'] ?? ''), 200);

$msg = $locale === 'kk'
    ? ['name' => 'Атыңызды көрсетіңіз (кемінде 2 таңба)', 'contact' => 'Телефон немесе e-mail көрсетіңіз', 'message' => 'Хабарлама жазыңыз (кемінде 10 таңба)', 'consent' => 'Деректерді өңдеуге келісімсіз өтінім жіберу мүмкін емес']
    : ['name' => 'Укажите имя (минимум 2 символа)', 'contact' => 'Укажите телефон или e-mail', 'message' => 'Напишите сообщение (минимум 10 символов)', 'consent' => 'Без согласия на обработку данных отправить заявку нельзя'];

$errors = [];
if (mb_strlen($name) < 2) {
    $errors['name'] = $msg['name'];
}
$isPhone = preg_match('/^\+?[\d\s()\-]{10,20}$/', $contact) === 1;
$isMail = filter_var($contact, FILTER_VALIDATE_EMAIL) !== false;
if (!$isPhone && !$isMail) {
    $errors['contact'] = $msg['contact'];
}
if (mb_strlen($message) < 10) {
    $errors['message'] = $msg['message'];
}
if (!$consent) {
    $errors['consent'] = $msg['consent'];
}
if ($errors) {
    hm_respond(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);
}

$lines = [
    'Имя: ' . $name,
    'Контакт: ' . $contact,
    'Сообщение: ' . $message,
    'Язык: ' . strtoupper($locale) . ', страница: ' . $page,
    'Согласие на ПДн: да, ' . date('d.m.Y H:i'),
];
$text = "Новый вопрос с сайта (Hydromed)\n" . implode("\n", $lines);
$html = '<h2 style="font-family:sans-serif">Новый вопрос с сайта — Hydromed</h2><p style="font-family:sans-serif;white-space:pre-line">' . hm_esc(implode("\n", $lines)) . '</p>';

$mailOk = hm_send_mail('Вопрос с сайта: ' . $name, $html, $text);
$tgOk = hm_send_telegram("💬 <b>Вопрос с сайта</b>\n" . hm_esc(implode("\n", $lines)));

hm_log('contact', [
    'name' => $name,
    'contact' => $contact,
    'message' => $message,
    'locale' => $locale,
    'consent' => true,
    'consent_doc' => 'consent-v1',
    'delivered' => ['mail' => $mailOk, 'telegram' => $tgOk],
]);

hm_respond(200, ['ok' => true]);
