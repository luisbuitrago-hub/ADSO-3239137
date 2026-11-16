<?php

namespace Tests\Support;

use App\Application\Ports\PasswordHasher;
use App\Application\Services\LoginService;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

abstract class SecurityTestCase extends TestCase
{
    protected string $testPassword = ' Test password 123! ';

    protected function setUp(): void
    {
        parent::setUp();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:') {
            throw new \RuntimeException('Estas pruebas solo permiten SQLite en memoria.');
        }
        config(['jwt.secret' => bin2hex(random_bytes(32)), 'jwt.algo' => 'HS256', 'jwt.leeway' => 0]);
        Schema::create('user', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('username', 120)->unique();
            $table->string('password_hash', 512);
            $table->string('role', 40);
        });
    }

    protected function user(string $role = 'admin', string $username = 'admin'): User
    {
        return User::factory()->create([
            'username' => $username, 'role' => $role,
            'password_hash' => app(PasswordHasher::class)->hash($this->testPassword),
        ]);
    }

    protected function tokenFor(User $user): string
    {
        return app(LoginService::class)->login($user->username, $this->testPassword)['access_token'];
    }

    protected function operatorData(): array
    {
        return ['username' => ' NewOperator ', 'password' => $this->testPassword, 'role' => 'operator'];
    }

    protected function signedPayload(array $payload): string
    {
        $encode = fn (string $value) => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $body = $encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256'])).'.'.$encode(json_encode($payload));

        return $body.'.'.$encode(hash_hmac('sha256', $body, config('jwt.secret'), true));
    }
}
