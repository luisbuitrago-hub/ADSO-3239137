<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class LoginTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Clave exclusiva de pruebas; no es la clave real del proyecto.
        config(['jwt.secret' => str_repeat('a', 64)]);

        // Tabla temporal en SQLite, independiente de PostgreSQL.
        Schema::create('user', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('username')->unique();
            $table->string('password_hash');
            $table->string('role');
        });
    }

    public function test_login_requires_username(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'password' => 'some-password',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['username']);
    }

    public function test_login_requires_password(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'username' => 'admin',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['password']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'username' => 'unknown',
            'password' => 'wrong-password',
        ])->assertUnauthorized()
          ->assertJson([
              'message' => 'Credenciales incorrectas.',
          ]);
    }

    public function test_login_returns_jwt_for_valid_credentials(): void
    {
    $user = new User();
    $user->id = (string) Str::uuid();
    $user->username = 'admin';
    $user->password_hash = Hash::make('TestPassword123!');
    $user->role = 'admin';
    $user->save();

        $this->postJson('/api/v1/auth/login', [
            'username' => 'admin',
            'password' => 'TestPassword123!',
        ])->assertOk()
          ->assertJsonStructure([
              'access_token',
              'token_type',
              'expires_in',
          ])
          ->assertJsonPath('token_type', 'bearer');
    }
}