<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (Artisan::call('kitchenware:initialize-admin', ['--force' => true]) !== 0) {
            throw new \RuntimeException('No fue posible inicializar el administrador desde las variables de entorno.');
        }
    }
}
