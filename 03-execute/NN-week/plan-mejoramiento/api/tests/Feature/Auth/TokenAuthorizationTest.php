<?php

namespace Tests\Feature\Auth;

use Illuminate\Support\Facades\Route;
use PHPOpenSourceSaver\JWTAuth\JWT;
use Tests\Support\SecurityTestCase;

class TokenAuthorizationTest extends SecurityTestCase
{
    public function test_missing_malformed_and_query_string_tokens_are_unauthorized_even_without_json_accept(): void
    {
        $this->post('/api/v1/users', [])->assertUnauthorized()->assertJsonPath('code', 'INVALID_CREDENTIALS');
        $this->withToken('invalid')->postJson('/api/v1/users', $this->operatorData())->assertUnauthorized();
        $token = $this->tokenFor($this->user());
        $this->flushHeaders();
        $this->postJson('/api/v1/users?token='.urlencode($token), $this->operatorData())->assertUnauthorized();
    }

    public function test_token_is_valid_before_eight_hours_and_expired_afterwards(): void
    {
        $this->freezeTime();
        $token = $this->tokenFor($this->user());
        $this->travel(479)->minutes();
        $this->withToken($token)->postJson('/api/v1/users', $this->operatorData())->assertCreated();
        $this->travel(2)->minutes();
        $this->withToken($token)->postJson('/api/v1/users', $this->operatorData())->assertUnauthorized()->assertJsonPath('code', 'INVALID_CREDENTIALS');
    }

    public function test_tampered_signature_and_missing_role_are_rejected(): void
    {
        $token = $this->tokenFor($this->user());
        $payload = app(JWT::class)->setToken($token)->getPayload()->toArray();
        $payload['role'] = 'operator';
        $signed = $this->signedPayload($payload);
        [$header, $body] = explode('.', $signed);
        $this->withToken($header.'.'.$body.'.'.str_repeat('x', 43))->postJson('/api/v1/users', [])->assertUnauthorized();
        unset($payload['role']);
        $this->withToken($this->signedPayload($payload))->postJson('/api/v1/users', [])->assertUnauthorized();
    }

    public function test_authorization_uses_current_database_role_and_rejects_unknown_subject(): void
    {
        $user = $this->user();
        $token = $this->tokenFor($user);
        $user->update(['role' => 'operator']);
        $this->withToken($token)->postJson('/api/v1/users', [])->assertForbidden();
        $payload = app(JWT::class)->setToken($token)->getPayload()->toArray();
        $payload['sub'] = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        $this->withToken($this->signedPayload($payload))->postJson('/api/v1/users', [])->assertUnauthorized();
    }

    public function test_role_middleware_accepts_both_documented_roles(): void
    {
        // Ruta exclusiva del proceso de pruebas; no se publica ningún endpoint nuevo.
        Route::get('/api/v1/testing-role', fn () => response()->json(['ok' => true]))->middleware(['bearer', 'role:admin,operator']);
        foreach (['admin', 'operator'] as $role) {
            $token = $this->tokenFor($this->user($role, $role));
            $this->withToken($token)->getJson('/api/v1/testing-role')->assertOk();
        }
    }
}
