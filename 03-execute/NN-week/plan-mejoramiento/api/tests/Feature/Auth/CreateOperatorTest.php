<?php

namespace Tests\Feature\Auth;

use App\Application\Ports\PasswordHasher;
use App\Models\User;
use Tests\Support\SecurityTestCase;

class CreateOperatorTest extends SecurityTestCase
{
    public function test_admin_creates_a_normalized_operator_with_a_bcrypt_hash(): void
    {
        $token = $this->tokenFor($this->user());
        $response = $this->withToken($token)->postJson('/api/v1/users', $this->operatorData())->assertCreated();
        $operator = User::where('username', 'newoperator')->firstOrFail();
        $response->assertExactJson(['id' => $operator->id, 'username' => 'newoperator', 'role' => 'operator']);
        $this->assertSame('bcrypt', password_get_info($operator->password_hash)['algoName']);
        $this->assertTrue(app(PasswordHasher::class)->verify($this->testPassword, $operator->password_hash));
        $this->assertNotSame($this->testPassword, $operator->password_hash);
        $this->postJson('/api/v1/auth/login', ['username' => ' NEWOPERATOR ', 'password' => $this->testPassword])->assertOk()->assertJsonPath('role', 'operator');
    }

    public function test_normalized_duplicate_returns_conflict_without_overwriting(): void
    {
        $token = $this->tokenFor($this->user());
        $original = $this->user('operator', 'registered');
        $data = array_replace($this->operatorData(), ['username' => ' REGISTERED ']);
        $this->withToken($token)->postJson('/api/v1/users', $data)->assertConflict()->assertExactJson([
            'code' => 'USERNAME_TAKEN', 'message' => 'El nombre de usuario ya está registrado.', 'details' => [],
        ]);
        $this->assertSame($original->password_hash, $original->fresh()->password_hash);
        $this->assertSame(2, User::count());
    }

    public function test_admin_creation_and_invalid_roles_are_rejected(): void
    {
        $token = $this->tokenFor($this->user());
        foreach (['admin', 'neighbor', '', null] as $role) {
            $this->withToken($token)->postJson('/api/v1/users', array_replace($this->operatorData(), ['role' => $role]))
                ->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
        $this->assertSame(1, User::count());
    }

    public function test_role_is_required_and_empty_or_overlong_credentials_are_rejected(): void
    {
        $token = $this->tokenFor($this->user());
        $invalid = [
            ['username' => '   '], ['username' => str_repeat('a', 121)],
            ['password' => ''], ['password' => str_repeat('ñ', 37)],
        ];
        foreach ($invalid as $overrides) {
            $this->withToken($token)->postJson('/api/v1/users', array_replace($this->operatorData(), $overrides))->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
        $data = $this->operatorData();
        unset($data['role']);
        $this->withToken($token)->postJson('/api/v1/users', $data)->assertUnprocessable();
        $this->assertSame(1, User::count());
    }

    public function test_operator_is_forbidden_before_validating_request_data(): void
    {
        $token = $this->tokenFor($this->user('operator', 'operator'));
        $this->withToken($token)->postJson('/api/v1/users', [])->assertForbidden()->assertExactJson([
            'code' => 'FORBIDDEN_ROLE', 'message' => 'No tienes permisos para realizar esta operación.', 'details' => [],
        ]);
        $this->assertSame(1, User::count());
    }

    public function test_client_cannot_assign_an_identifier_or_password_hash(): void
    {
        $token = $this->tokenFor($this->user());
        $untrustedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        $data = array_replace($this->operatorData(), ['id' => $untrustedId, 'password_hash' => 'untrusted-hash']);
        $response = $this->withToken($token)->postJson('/api/v1/users', $data)->assertCreated();
        $this->assertNotSame($untrustedId, $response->json('id'));
        $operator = User::where('username', 'newoperator')->firstOrFail();
        $this->assertNotSame('untrusted-hash', $operator->password_hash);
        $this->assertTrue(app(PasswordHasher::class)->verify($this->testPassword, $operator->password_hash));
    }
}
