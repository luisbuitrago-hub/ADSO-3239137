<?php

namespace Tests\Support;

use App\Application\Ports\Clock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

abstract class ConcurrentPostgresTestCase extends TestCase
{
    private ?string $isolatedDatabase = null;

    private array $children = [];

    protected function setUp(): void
    {
        parent::setUp();
        if (! app()->environment('testing') || config('database.default') !== 'pgsql_testing' || ! getenv('TEST_DB_PORT')) {
            throw new \RuntimeException('Concurrencia requiere el runner PostgreSQL temporal.');
        }
        $admin = DB::connection('pgsql_testing');
        $identity = $admin->selectOne('SELECT current_database() AS database, current_user AS username');
        if ($identity->database !== 'kitchenware_test' || $identity->username !== 'kitchenware_test'
            || $admin->getConfig('host') !== '127.0.0.1' || (int) $admin->getConfig('port') === 5432) {
            throw new \RuntimeException('Se rechazó una conexión ajena al PostgreSQL temporal.');
        }
        $name = 'kitchenware_concurrency_'.str_replace('-', '', (string) Str::uuid());
        $admin->statement('CREATE DATABASE "'.$name.'" TEMPLATE template0');
        $this->isolatedDatabase = $name;
        $config = config('database.connections.pgsql_testing');
        $config['database'] = $name;
        config(['database.connections.concurrent' => $config, 'database.connections.race_gate' => $config, 'database.default' => 'concurrent']);
        $this->artisan('kitchenware:prepare-database', ['--force' => true])->assertExitCode(0);
        config(['jwt.secret' => bin2hex(random_bytes(32)), 'jwt.algo' => 'HS256', 'hashing.bcrypt.rounds' => 4]);
    }

    protected function tearDown(): void
    {
        try {
            foreach ($this->children as $child) {
                if (is_resource($child['process'])) {
                    if (proc_get_status($child['process'])['running']) {
                        proc_terminate($child['process']);
                    }
                    foreach ($child['pipes'] as $pipe) {
                        if (is_resource($pipe)) {
                            fclose($pipe);
                        }
                    }
                    proc_close($child['process']);
                }
            }
            DB::purge('race_gate');
            DB::purge('concurrent');
            config(['database.default' => 'pgsql_testing']);
            if ($this->isolatedDatabase !== null && preg_match('/^kitchenware_concurrency_[a-f0-9]{32}$/D', $this->isolatedDatabase)) {
                // Solo esta base recién creada, dentro del contenedor de pruebas.
                DB::connection('pgsql_testing')->statement('DROP DATABASE "'.$this->isolatedDatabase.'"');
            }
        } finally {
            parent::tearDown();
        }
    }

    /** Lanza dos peticiones en procesos distintos y exige observar ambos bloqueados antes de liberar la compuerta. */
    protected function race(array $requests, string $table, string $id): array
    {
        if (! in_array($table, ['article', 'neighbor'], true)) {
            throw new \InvalidArgumentException('Compuerta de pruebas inválida.');
        }
        $gate = DB::connection('race_gate');
        $gate->beginTransaction();
        $gate->table($table)->where('id', $id)->lockForUpdate()->first();
        try {
            $started = [];
            foreach ($requests as $request) {
                $process = proc_open([PHP_BINARY, __DIR__.'/loan-worker.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path());
                if (! is_resource($process)) {
                    throw new \RuntimeException('No fue posible iniciar el proceso concurrente.');
                }
                stream_set_blocking($pipes[1], false);
                stream_set_blocking($pipes[2], false);
                $child = ['process' => $process, 'pipes' => $pipes];
                $this->children[] = $child;
                fwrite($pipes[0], json_encode($request + ['database' => $this->isolatedDatabase, 'secret' => config('jwt.secret'),
                    'now' => app(Clock::class)->now()->format('Y-m-d\TH:i:sP')])."\n");
                fflush($pipes[0]);
                $ready = $this->readMessage($pipes[1]);
                $this->assertTrue($ready['ready'] ?? false, 'El proceso debe verificar su conexión antes de ejecutar la petición.');
                $started[] = $child + ['db_pid' => $ready['db_pid']];
            }
            $this->assertNotSame($started[0]['db_pid'], $started[1]['db_pid']);
            foreach ($started as $child) {
                fwrite($child['pipes'][0], "go\n");
                fflush($child['pipes'][0]);
            }
            $deadline = microtime(true) + 8;
            do {
                $waiting = (int) DB::selectOne("SELECT COUNT(*) AS total FROM pg_stat_activity
                    WHERE datname = ? AND pid IN (?, ?) AND state = 'active' AND wait_event_type = 'Lock'",
                    [$this->isolatedDatabase, $started[0]['db_pid'], $started[1]['db_pid']])->total;
                if ($waiting === 2) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertSame(2, $waiting, 'Deben coexistir dos peticiones reales esperando bloqueos en PostgreSQL.');
            $gate->commit();
            $results = [];
            foreach ($started as $child) {
                $results[] = $this->readMessage($child['pipes'][1]);
            }

            return ['responses' => $results, 'blocked_connections' => $waiting];
        } finally {
            if ($gate->transactionLevel() > 0) {
                $gate->rollBack();
            }
        }
    }

    private function readMessage($stream): array
    {
        $buffer = '';
        $deadline = microtime(true) + 15;
        while (microtime(true) < $deadline) {
            $part = fgets($stream);
            if ($part !== false) {
                $buffer .= $part;
                if (str_ends_with($buffer, "\n")) {
                    $message = json_decode(trim($buffer), true, flags: JSON_THROW_ON_ERROR);
                    if (isset($message['error'])) {
                        throw new \RuntimeException('El proceso concurrente falló: '.$message['error']);
                    }

                    return $message;
                }
            }
            if (feof($stream)) {
                throw new \RuntimeException('El proceso concurrente terminó sin entregar su resultado.');
            }
            usleep(10000);
        }
        throw new \RuntimeException('Tiempo agotado esperando el proceso concurrente.');
    }
}
