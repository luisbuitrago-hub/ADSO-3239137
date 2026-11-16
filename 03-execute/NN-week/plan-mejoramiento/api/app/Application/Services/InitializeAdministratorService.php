<?php

namespace App\Application\Services;

use App\Application\Ports\IdGenerator;
use App\Application\Ports\PasswordHasher;
use App\Application\Ports\UserRepository;
use App\Domain\Entities\User;
use App\Domain\ValueObjects\Username;

final readonly class InitializeAdministratorService
{
    public function __construct(private UserRepository $users, private PasswordHasher $passwords, private IdGenerator $ids) {}

    public function initialize(string $username, #[\SensitiveParameter] string $password): void
    {
        $name = new Username($username);
        $existing = $this->users->findByUsername($name->value);
        if ($existing !== null && $existing->role === 'admin') {
            return;
        }
        if ($existing !== null || $this->users->findAdministrator() !== null) {
            throw new \RuntimeException('La inicialización entra en conflicto con un usuario existente.');
        }
        $this->users->create(new User($this->ids->generate(), $name, 'admin', $this->passwords->hash($password)));
    }
}
