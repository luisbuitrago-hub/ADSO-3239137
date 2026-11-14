<?php

namespace Tests\Support;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

abstract class PostgresTestCase extends TestCase
{
    private bool $transactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();

        if (! app()->environment('testing') || config('database.default') !== 'pgsql_testing') {
            throw new \RuntimeException('Integración requiere la conexión exclusiva pgsql_testing.');
        }

        $connection = DB::connection();
        $identity = $connection->selectOne('SELECT current_database() AS database, current_user AS username');

        if ($connection->getDriverName() !== 'pgsql'
            || $identity->database !== 'kitchenware_test'
            || $identity->username !== 'kitchenware_test'
            || $connection->getConfig('search_path') !== 'kitchenware') {
            throw new \RuntimeException('Se rechazó una conexión que no corresponde a PostgreSQL de pruebas.');
        }

        if ($connection->selectOne("SELECT 1 FROM pg_namespace WHERE nspname = 'kitchenware'")) {
            throw new \RuntimeException('Las pruebas requieren un contenedor nuevo sin esquema kitchenware.');
        }

        // PostgreSQL revierte también CREATE SCHEMA y CREATE TABLE al finalizar.
        $connection->beginTransaction();
        $this->transactionStarted = true;

        $this->artisan('kitchenware:prepare-database', ['--force' => true])->assertExitCode(0);
    }

    protected function tearDown(): void
    {
        try {
            if ($this->transactionStarted) {
                DB::connection()->rollBack(0);
            }
        } finally {
            parent::tearDown();
        }
    }

    protected function article(array $overrides = []): array
    {
        return array_replace([
            'id' => (string) Str::uuid(),
            'name' => 'Olla grande',
            'description' => 'Olla de prueba',
            'reference' => 'OLL-001',
            'category_id' => '11111111-1111-4111-8111-111111111111',
            'total_units' => 2,
            'available_units' => 2,
        ], $overrides);
    }

    protected function loanItem(): array
    {
        $neighborId = (string) Str::uuid();
        $userId = (string) Str::uuid();
        $loanId = (string) Str::uuid();
        $article = $this->article();

        DB::table('neighbor')->insert(['id' => $neighborId, 'full_name' => 'Vecino', 'document_number' => '123']);
        DB::table('user')->insert([
            'id' => $userId, 'username' => 'operator',
            'password_hash' => password_hash('test-only', PASSWORD_BCRYPT), 'role' => 'operator',
        ]);
        DB::table('article')->insert($article);
        DB::table('loan')->insert([
            'id' => $loanId, 'neighbor_id' => $neighborId,
            'loaned_by_user_id' => $userId, 'loaned_at' => '2026-11-14 12:00:00+00',
        ]);

        return [
            'id' => (string) Str::uuid(), 'loan_id' => $loanId, 'article_id' => $article['id'],
            'article_name' => $article['name'], 'article_reference' => $article['reference'],
            'category_name' => 'ollas', 'due_at' => '2026-11-17 12:00:00+00',
        ];
    }

    protected function assertRejected(callable $operation, string $sqlState, string|array $constraint): void
    {
        try {
            // El savepoint permite continuar comprobando datos tras un rechazo SQL.
            DB::transaction($operation);
        } catch (QueryException $exception) {
            $this->assertSame($sqlState, $exception->errorInfo[0]);
            $matches = array_filter((array) $constraint, fn (string $name) => str_contains($exception->getMessage(), $name));
            $this->assertNotEmpty($matches, 'El rechazo debe corresponder a la restricción esperada.');

            return;
        }

        $this->fail('PostgreSQL aceptó una operación que debía rechazar.');
    }
}
