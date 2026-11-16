<?php

namespace Tests\Feature\Auth;

use App\Application\Ports\PasswordHasher;
use App\Models\User;
use Tests\Support\SecurityTestCase;

class InitializeAdministratorTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['kitchenware.admin_username' => ' InitialAdmin ', 'kitchenware.admin_password' => $this->testPassword]);
    }

    public function test_command_initializes_admin_and_repetition_does_not_reset_password(): void
    {
        $this->artisan('kitchenware:initialize-admin')->assertSuccessful();
        $admin = User::sole();
        $this->assertSame('initialadmin', $admin->username);
        $this->assertSame('admin', $admin->role);
        $this->assertTrue(app(PasswordHasher::class)->verify($this->testPassword, $admin->password_hash));
        config(['kitchenware.admin_password' => 'different test password']);
        $this->artisan('kitchenware:initialize-admin')->assertSuccessful();
        $this->assertSame(1, User::count());
        $this->assertSame($admin->password_hash, $admin->fresh()->password_hash);
        $this->postJson('/api/v1/auth/login', ['username' => 'INITIALADMIN', 'password' => $this->testPassword])->assertOk();
    }

    public function test_missing_configuration_fails_without_creating_a_user(): void
    {
        config(['kitchenware.admin_password' => null]);
        $this->artisan('kitchenware:initialize-admin')->assertFailed();
        $this->assertSame(0, User::count());
    }

    public function test_existing_operator_is_never_elevated_and_existing_admin_is_preserved(): void
    {
        $operator = $this->user('operator', 'initialadmin');
        $this->artisan('kitchenware:initialize-admin')->assertFailed();
        $this->assertSame('operator', $operator->fresh()->role);
        config(['kitchenware.admin_username' => 'anotheradmin']);
        $admin = $this->user('admin', 'originaladmin');
        $this->artisan('kitchenware:initialize-admin')->assertFailed();
        $this->assertSame('admin', $admin->fresh()->role);
        $this->assertSame(2, User::count());
    }

    public function test_production_requires_force_before_initializing(): void
    {
        app()->instance('env', 'production');
        $this->artisan('kitchenware:initialize-admin')->assertFailed();
        $this->assertSame(0, User::count());
        $this->artisan('kitchenware:initialize-admin', ['--force' => true])->assertSuccessful();
    }
}
