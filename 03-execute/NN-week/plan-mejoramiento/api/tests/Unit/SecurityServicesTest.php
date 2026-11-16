<?php

namespace Tests\Unit;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\PasswordHasher;
use App\Application\Ports\TokenIssuer;
use App\Application\Ports\UserRepository;
use App\Application\Services\CreateOperatorService;
use App\Application\Services\InitializeAdministratorService;
use App\Application\Services\LoginService;
use App\Domain\Entities\User;
use App\Domain\ValueObjects\Username;
use PHPUnit\Framework\TestCase;

class SecurityServicesTest extends TestCase
{
    public function test_login_uses_ports_without_framework_or_database(): void
    {
        $user = new User('test-id', new Username('operator'), 'operator', 'test-hash');
        $users = $this->createMock(UserRepository::class);
        $users->expects($this->once())->method('findByUsername')->with('operator')->willReturn($user);
        $passwords = $this->createMock(PasswordHasher::class);
        $passwords->expects($this->once())->method('verify')->with('test-password', 'test-hash')->willReturn(true);
        $tokens = $this->createMock(TokenIssuer::class);
        $tokens->expects($this->once())->method('issue')->with($user)->willReturn('test-token');
        $result = (new LoginService($users, $passwords, $tokens))->login(' OPERATOR ', 'test-password');
        $this->assertSame(['access_token' => 'test-token', 'token_type' => 'Bearer', 'expires_in' => 28800, 'role' => 'operator'], $result);
    }

    public function test_failed_login_does_not_issue_a_token(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('findByUsername')->willReturn(null);
        $tokens = $this->createMock(TokenIssuer::class);
        $tokens->expects($this->never())->method('issue');
        $this->expectException(SecurityFailure::class);
        (new LoginService($users, $this->createMock(PasswordHasher::class), $tokens))->login('unknown', 'test-password');
    }

    public function test_operator_creation_hashes_password_and_saves_only_operator_role(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('findByUsername')->with('operator')->willReturn(null);
        $users->expects($this->once())->method('create')->with($this->callback(function (User $user) {
            return $user->publicData() === ['id' => 'test-id', 'username' => 'operator', 'role' => 'operator'] && $user->passwordHash() === 'hashed-fixture';
        }));
        $passwords = $this->createMock(PasswordHasher::class);
        $passwords->expects($this->once())->method('hash')->with('test-password')->willReturn('hashed-fixture');
        $ids = $this->createMock(IdGenerator::class);
        $ids->method('generate')->willReturn('test-id');
        (new CreateOperatorService($users, $passwords, $ids))->create('admin', ' Operator ', 'test-password', 'operator');
    }

    public function test_application_rejects_operator_as_creator_before_accessing_storage(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->expects($this->never())->method('findByUsername');
        $users->expects($this->never())->method('create');
        $this->expectException(SecurityFailure::class);
        (new CreateOperatorService($users, $this->createMock(PasswordHasher::class), $this->createMock(IdGenerator::class)))
            ->create('operator', 'operator', 'test-password', 'operator');
    }

    public function test_initialization_never_rehashes_or_saves_an_existing_admin(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('findByUsername')->willReturn(new User('test-id', new Username('admin'), 'admin', 'existing-hash'));
        $users->expects($this->never())->method('create');
        $passwords = $this->createMock(PasswordHasher::class);
        $passwords->expects($this->never())->method('hash');
        (new InitializeAdministratorService($users, $passwords, $this->createMock(IdGenerator::class)))->initialize('admin', 'new-fixture');
    }

    public function test_application_rejects_creating_an_admin_even_without_http_validation(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->expects($this->never())->method('create');
        $this->expectException(SecurityFailure::class);
        (new CreateOperatorService($users, $this->createMock(PasswordHasher::class), $this->createMock(IdGenerator::class)))
            ->create('admin', 'another-admin', 'test-password', 'admin');
    }
}
