<?php

namespace Tests\Integration;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\UserRepository;
use App\Domain\Entities\User as DomainUser;
use App\Domain\ValueObjects\Username;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPOpenSourceSaver\JWTAuth\JWT;
use Tests\Support\PostgresTestCase;

class SecurityPersistenceTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'jwt.secret' => bin2hex(random_bytes(32)),
            'jwt.algo' => 'HS256',
            'hashing.bcrypt.rounds' => 4,
            'kitchenware.admin_username' => ' InitialAdmin ',
            'kitchenware.admin_password' => ' PostgreSQL test password! ',
        ]);
    }

    private function adminToken(): string
    {
        $this->artisan('kitchenware:initialize-admin')->assertSuccessful();

        return $this->postJson('/api/v1/auth/login', [
            'username' => ' INITIALADMIN ', 'password' => config('kitchenware.admin_password'),
        ])->assertOk()->assertJsonPath('expires_in', 28800)->json('access_token');
    }

    public function test_admin_can_create_an_operator_that_can_login_against_real_migrations(): void
    {
        $token = $this->adminToken();
        $password = ' Integration operator test! ';
        $response = $this->withToken($token)->postJson('/api/v1/users', [
            'username' => ' OPERATOR ', 'password' => $password, 'role' => 'operator',
        ])->assertCreated();
        $operator = User::where('username', 'operator')->firstOrFail();
        $response->assertExactJson(['id' => $operator->id, 'username' => 'operator', 'role' => 'operator']);
        $this->assertSame('bcrypt', password_get_info($operator->password_hash)['algoName']);
        $this->assertTrue(password_verify($password, $operator->password_hash));
        $login = $this->postJson('/api/v1/auth/login', ['username' => 'Operator', 'password' => $password])
            ->assertOk()->assertJsonPath('token_type', 'Bearer')->assertJsonPath('role', 'operator');
        $payload = app(JWT::class)->setToken($login->json('access_token'))->getPayload();
        $this->assertSame($operator->id, $payload['sub']);
        $this->assertSame('operator', $payload['role']);
        $this->assertSame(28800, $payload['exp'] - $payload['iat']);
        $this->withToken($login->json('access_token'))->postJson('/api/v1/users', [])->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
    }

    public function test_normalized_username_conflicts_preserve_postgresql_transaction(): void
    {
        $token = $this->adminToken();
        $data = ['username' => 'operator', 'password' => 'Test operator password!', 'role' => 'operator'];
        $this->withToken($token)->postJson('/api/v1/users', $data)->assertCreated();
        $data['username'] = ' OPERATOR ';
        $this->withToken($token)->postJson('/api/v1/users', $data)->assertConflict()->assertJsonPath('code', 'USERNAME_TAKEN');
        $this->assertSame(2, User::count());
    }

    public function test_database_duplicate_is_translated_without_exposing_hashes_or_sql(): void
    {
        $this->adminToken();
        $existing = User::where('username', 'initialadmin')->firstOrFail();
        $candidate = new DomainUser((string) Str::uuid(), new Username('INITIALADMIN'), 'operator', $existing->password_hash);
        try {
            // Simula una colisión ocurrida después de la consulta previa del caso de uso.
            app(UserRepository::class)->create($candidate);
            $this->fail('Se esperaba un conflicto de usuario.');
        } catch (SecurityFailure $exception) {
            $this->assertSame('USERNAME_TAKEN', $exception->errorCode);
            $this->assertSame(409, $exception->status);
            $this->assertNull($exception->getPrevious());
            $this->assertStringNotContainsString($existing->password_hash, $exception->getMessage());
        }
        $this->assertSame(1, User::count());
    }

    public function test_seeder_initializes_only_the_environment_admin_and_can_be_repeated(): void
    {
        $this->seed();
        $admin = User::sole();
        $this->assertSame('initialadmin', $admin->username);
        config(['kitchenware.admin_password' => 'A different test password!']);
        $this->seed();
        $this->assertSame(1, User::count());
        $this->assertSame($admin->password_hash, $admin->fresh()->password_hash);
        $this->assertSame(5, DB::table('category')->count());
    }
}
