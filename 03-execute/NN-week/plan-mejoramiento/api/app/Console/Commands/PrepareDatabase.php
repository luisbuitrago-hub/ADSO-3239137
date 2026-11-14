<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PrepareDatabase extends Command
{
    protected $signature = 'kitchenware:prepare-database
                            {--force : Permitir la inicialización en producción}';

    protected $description = 'Crear el esquema kitchenware y ejecutar las migraciones pendientes';

    public function handle(): int
    {
        $connection = DB::connection();

        if ($connection->getDriverName() !== 'pgsql'
            || $connection->getConfig('search_path') !== 'kitchenware') {
            $this->error('Se requiere PostgreSQL con el esquema fijo kitchenware.');

            return self::FAILURE;
        }

        // Confirmar antes de crear el esquema, no solo antes de migrar.
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('En producción debes indicar --force para preparar la base de datos.');

            return self::FAILURE;
        }

        // Debe existir antes de que migrate cree su propia tabla migrations.
        $connection->statement('CREATE SCHEMA IF NOT EXISTS "kitchenware"');

        return $this->call('migrate', [
            '--database' => $connection->getName(),
            '--force' => (bool) $this->option('force'),
        ]);
    }
}
