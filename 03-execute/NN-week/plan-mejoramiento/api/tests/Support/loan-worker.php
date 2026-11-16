<?php

use App\Application\Ports\Clock;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PHPOpenSourceSaver\JWTAuth\JWT;
use Tests\Support\MutableClock;

// Entrada exclusiva de pruebas: no es una ruta HTTP ni un comando de producción.
foreach (['APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql_testing', 'DB_URL' => '', 'CACHE_STORE' => 'array',
    'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'LOG_CHANNEL' => 'stderr'] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}
try {
    require __DIR__.'/../bootstrap.php';
    $input = json_decode(trim(fgets(STDIN)), true, flags: JSON_THROW_ON_ERROR);
    if (! preg_match('/^kitchenware_concurrency_[a-f0-9]{32}$/D', $input['database'] ?? '') || ! getenv('TEST_DB_PORT') || (int) getenv('TEST_DB_PORT') === 5432) {
        throw new RuntimeException('Destino de pruebas inválido.');
    }
    $app = require __DIR__.'/../../bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    $config = config('database.connections.pgsql_testing');
    $config['database'] = $input['database'];
    config(['database.connections.concurrent' => $config, 'database.default' => 'concurrent', 'jwt.secret' => $input['secret'], 'jwt.algo' => 'HS256']);
    $app->instance(Clock::class, new MutableClock(new DateTimeImmutable($input['now'])));
    $connection = DB::connection();
    $identity = $connection->selectOne('SELECT current_database() AS database, current_user AS username, pg_backend_pid() AS pid');
    if ($identity->database !== $input['database'] || $identity->username !== 'kitchenware_test' || $config['host'] !== '127.0.0.1') {
        throw new RuntimeException('Identidad PostgreSQL inválida.');
    }
    $connection->statement("SET lock_timeout = '12s'");
    $connection->statement("SET statement_timeout = '15s'");
    $actor = User::findOrFail($input['actor_id']);
    $token = $app->make(JWT::class)->fromUser($actor);
    echo json_encode(['ready' => true, 'db_pid' => $identity->pid])."\n";
    fflush(STDOUT);
    if (trim(fgets(STDIN)) !== 'go') {
        throw new RuntimeException('Compuerta inválida.');
    }
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $request = Request::create($input['path'], $input['method'] ?? 'POST', [], [], [],
        ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$token], json_encode($input['payload'] ?? []));
    $response = $kernel->handle($request);
    echo json_encode(['status' => $response->getStatusCode(), 'body' => json_decode($response->getContent(), true), 'db_pid' => $identity->pid])."\n";
    fflush(STDOUT);
    $kernel->terminate($request, $response);
    $connection->disconnect();
} catch (Throwable $exception) {
    // No imprimir entradas, credenciales ni trazas de los procesos de pruebas.
    echo json_encode(['error' => $exception::class])."\n";
    exit(1);
}
