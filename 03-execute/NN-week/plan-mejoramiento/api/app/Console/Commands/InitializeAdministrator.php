<?php

namespace App\Console\Commands;

use App\Application\Services\InitializeAdministratorService;
use App\Domain\ValueObjects\Username;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class InitializeAdministrator extends Command
{
    protected $signature = 'kitchenware:initialize-admin {--force : Permitir la inicialización en producción}';

    protected $description = 'Inicializar el administrador desde ADMIN_USERNAME y ADMIN_PASSWORD sin sobrescribir usuarios';

    public function handle(InitializeAdministratorService $service): int
    {
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('En producción debes indicar --force para inicializar el administrador.');

            return self::FAILURE;
        }
        $username = config('kitchenware.admin_username');
        if (is_string($username)) {
            $username = Username::normalize($username);
        }
        $password = config('kitchenware.admin_password');
        $validator = Validator::make(['username' => $username, 'password' => $password], [
            'username' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string'],
        ]);
        if ($validator->fails() || ! is_string($password) || strlen($password) > 72) {
            $this->error('Configura ADMIN_USERNAME y ADMIN_PASSWORD válidos; la contraseña admite hasta 72 bytes.');

            return self::FAILURE;
        }
        try {
            $service->initialize($username, $password);
        } catch (\Throwable) {
            // No imprimir excepciones SQL ni credenciales desde el entorno.
            $this->error('No fue posible inicializar el administrador. Revisa la configuración y los usuarios existentes.');

            return self::FAILURE;
        }
        $this->info('Administrador inicial disponible. No se modificaron contraseñas existentes.');

        return self::SUCCESS;
    }
}
