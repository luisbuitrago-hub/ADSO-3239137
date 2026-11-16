<?php

namespace Tests\Feature\Auth;

use PHPOpenSourceSaver\JWTAuth\JWT;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\SecurityTestCase;

class LoginTest extends SecurityTestCase
{
    public static function missingFields(): array
    {
        return [['username'], ['password']];
    }

    #[DataProvider('missingFields')]
    public function test_login_requires_credentials_with_uniform_spanish_errors(string $field): void
    {
        $data = ['username' => 'admin', 'password' => $this->testPassword];
        unset($data[$field]);
        $this->postJson('/api/v1/auth/login', $data)->assertUnprocessable()->assertExactJson([
            'code' => 'VALIDATION_ERROR', 'message' => 'Los datos enviados no son válidos.',
            'details' => [['field' => $field, 'issue' => 'El campo es obligatorio.']],
        ]);
    }

    public function test_invalid_user_and_wrong_password_return_the_same_error(): void
    {
        $this->user();
        foreach ([['username' => 'unknown', 'password' => $this->testPassword], ['username' => 'admin', 'password' => 'incorrect']] as $data) {
            $this->postJson('/api/v1/auth/login', $data)->assertUnauthorized()->assertExactJson([
                'code' => 'INVALID_CREDENTIALS', 'message' => 'Credenciales incorrectas.', 'details' => [],
            ]);
        }
    }

    public static function roles(): array
    {
        return [['admin'], ['operator']];
    }

    #[DataProvider('roles')]
    public function test_login_returns_the_exact_contract_and_signed_eight_hour_token(string $role): void
    {
        $user = $this->user($role);
        // Ni una configuración local antigua debe reducir la duración del contrato.
        config(['jwt.ttl' => 60]);
        $response = $this->postJson('/api/v1/auth/login', ['username' => ' ADMIN ', 'password' => $this->testPassword])
            ->assertOk()->assertJsonPath('token_type', 'Bearer')->assertJsonPath('expires_in', 28800)->assertJsonPath('role', $role);
        $this->assertSame(['access_token', 'token_type', 'expires_in', 'role'], array_keys($response->json()));
        $payload = app(JWT::class)->setToken($response->json('access_token'))->getPayload()->toArray();
        $this->assertSame($user->id, $payload['sub']);
        $this->assertSame($role, $payload['role']);
        $this->assertSame(28800, $payload['exp'] - $payload['iat']);
        $this->assertSame([], array_diff(array_keys($payload), ['sub', 'role', 'iss', 'iat', 'exp', 'nbf', 'jti', 'prv']));
        $this->assertArrayNotHasKey('password_hash', $user->toArray());
        $this->assertSame(4, (int) explode('-', $user->id)[2][0]);
    }

    public function test_whitespace_only_username_and_invalid_types_are_rejected(): void
    {
        foreach (['   ', ['admin'], 123] as $username) {
            $this->postJson('/api/v1/auth/login', ['username' => $username, 'password' => $this->testPassword])
                ->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
    }

    public function test_health_remains_public_and_me_is_not_added(): void
    {
        $this->getJson('/api/v1/health')->assertOk()->assertExactJson(['status' => 'ok']);
        $this->getJson('/api/v1/auth/me')->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
    }
}
