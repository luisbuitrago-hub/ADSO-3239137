<?php

namespace Tests\Feature;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class PrepareDatabaseCommandTest extends TestCase
{
    public function test_preparation_rejects_non_postgresql_connections(): void
    {
        $this->artisan('kitchenware:prepare-database')
            ->expectsOutput('Se requiere PostgreSQL con el esquema fijo kitchenware.')
            ->assertExitCode(1);

        $this->assertSame([], DB::select("SELECT name FROM sqlite_master WHERE type = 'table'"));
    }

    public function test_preparation_rejects_an_inconsistent_schema_before_writing(): void
    {
        $connection = Mockery::mock(Connection::class);
        $connection->shouldReceive('getDriverName')->andReturn('pgsql');
        $connection->shouldReceive('getConfig')->with('search_path')->andReturn('public');
        $connection->shouldNotReceive('statement');
        DB::shouldReceive('connection')->once()->andReturn($connection);

        $this->artisan('kitchenware:prepare-database')->assertExitCode(1);
    }

    public function test_production_requires_force_before_writing(): void
    {
        app()->instance('env', 'production');
        $connection = Mockery::mock(Connection::class);
        $connection->shouldReceive('getDriverName')->andReturn('pgsql');
        $connection->shouldReceive('getConfig')->with('search_path')->andReturn('kitchenware');
        $connection->shouldNotReceive('statement');
        DB::shouldReceive('connection')->once()->andReturn($connection);

        $this->artisan('kitchenware:prepare-database')
            ->expectsOutput('En producción debes indicar --force para preparar la base de datos.')
            ->assertExitCode(1);
    }
}
