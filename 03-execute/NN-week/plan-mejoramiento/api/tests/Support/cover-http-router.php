<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Servidor HTTP exclusivo de las pruebas: únicamente bases y archivos temporales.
foreach (['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql_testing', 'DB_URL' => '', 'CACHE_STORE' => 'array',
    'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'LOG_CHANNEL' => 'stderr'] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}
require __DIR__.'/../bootstrap.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$name = getenv('WIRE_DATABASE');
$root = getenv('WIRE_COVERS_ROOT');
if (! preg_match('/^kitchenware_concurrency_[a-f0-9]{32}$/D', $name) || ! preg_match('#^'.preg_quote(sys_get_temp_dir(), '#').'/kitchenware-covers-[a-f0-9]{32}$#D', $root)
    || ! getenv('TEST_DB_PORT') || (int) getenv('TEST_DB_PORT') === 5432) {
    http_response_code(500);
    exit;
}
$config = config('database.connections.pgsql_testing');
$config['database'] = $name;
config(['database.connections.wire' => $config, 'database.default' => 'wire', 'jwt.secret' => getenv('WIRE_SECRET'), 'jwt.algo' => 'HS256', 'filesystems.disks.covers.root' => $root]);
$identity = DB::connection()->selectOne('SELECT current_database() AS database, current_user AS username');
if ($identity->database !== $name || $identity->username !== 'kitchenware_test' || $config['host'] !== '127.0.0.1') {
    http_response_code(500);
    exit;
}
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Request::capture();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
