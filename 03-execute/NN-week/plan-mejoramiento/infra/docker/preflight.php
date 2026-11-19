<?php

// No cargar .env locales ni imprimir valores sensibles en errores de arranque.
$fail = static function (string $message): never {
    fwrite(STDERR, $message.PHP_EOL);
    exit(1);
};
foreach (['APP_KEY', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'DB_HOST', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'CORS_ORIGIN'] as $variable) {
    if (! is_string(getenv($variable)) || getenv($variable) === '') {
        $fail('Falta configurar '.$variable.'.');
    }
}
$key = getenv('APP_KEY');
if (! str_starts_with($key, 'base64:') || strlen(base64_decode(substr($key, 7), true) ?: '') !== 32) {
    $fail('APP_KEY debe contener 32 bytes aleatorios codificados en base64.');
}
if (strlen(getenv('JWT_SECRET')) < 32 || strlen(getenv('ADMIN_PASSWORD')) > 72) {
    $fail('Revisar longitud de JWT_SECRET y ADMIN_PASSWORD.');
}
$origin = getenv('CORS_ORIGIN');
if (! preg_match('~\Ahttps?://[^/\s?#@]+\z~D', $origin) || str_contains($origin, '*')) {
    $fail('CORS_ORIGIN debe ser un origen HTTP/HTTPS exacto, sin ruta ni comodines.');
}
foreach (['DB_HOST', 'DB_DATABASE', 'DB_USERNAME'] as $variable) {
    if (preg_match('/[;\s]/', getenv($variable))) {
        $fail('Configuración PostgreSQL inválida: '.$variable.'.');
    }
}
for ($attempt = 0; $attempt < 30; $attempt++) {
    try {
        $db = new PDO('pgsql:host='.getenv('DB_HOST').';port=5432;dbname='.getenv('DB_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'), [PDO::ATTR_TIMEOUT => 2]);
        $db->query('SELECT 1');
        exit(0);
    } catch (Throwable) {
        sleep(1);
    }
}
$fail('PostgreSQL no está disponible; no se inició el servidor HTTP.');
