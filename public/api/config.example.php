<?php
/**
 * Конфигурация форм Hydromed. Скопируйте в config.php и заполните. config.php НЕ коммитится
 * и закрыт от веб-доступа через .htaccess.
 */
return [
    // Разрешённые источники запросов (проверка заголовка Origin). Без завершающего слэша.
    'allowed_origins' => [
        'https://hydromed.kz',
        'https://www.hydromed.kz',
    ],

    // Куда приходят заявки
    'mail' => [
        'enabled'   => true,
        'to'        => ['zapis@hydromed.kz'],          // получатели
        'from'      => 'noreply@hydromed.kz',           // отправитель (должен существовать на хостинге)
        'from_name' => 'Hydromed — сайт',
        'smtp'      => [
            'host'     => 'localhost',                  // SMTP Plesk: обычно localhost или mail.<домен>
            'port'     => 587,
            'secure'   => 'tls',                        // 'tls' | 'ssl' | ''
            'username' => 'noreply@hydromed.kz',
            'password' => 'СМЕНИТЬ',
        ],
    ],

    // Уведомления в Telegram (Bot API). Создайте бота через @BotFather, добавьте в чат, узнайте chat_id.
    'telegram' => [
        'enabled' => false,
        'token'   => '123456789:AA...',
        'chat_id' => '-1001234567890',
    ],

    // Антиспам
    'rate_limit' => [
        'max'    => 5,        // запросов
        'window' => 600,      // за секунд (10 минут)
    ],
    'min_fill_seconds' => 3,  // быстрее — бот

    // Служебный каталог для лога и rate-limit: ВНЕ httpdocs, если возможно.
    // На Plesk: /var/www/vhosts/<домен>/api-data (создайте вручную, права 700/750 для пользователя сайта).
    // Если оставить null — используется api/_data (закрыт .htaccess, но лучше вынести).
    'data_dir' => null,

    // Хранить ли заявки в локальном журнале (JSONL). Срок хранения — см. Политику конфиденциальности (12 мес.).
    'log_requests' => true,
    'log_retention_days' => 365,
];
