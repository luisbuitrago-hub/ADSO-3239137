<?php

namespace App\Application\Services;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\PasswordHasher;
use App\Application\Ports\UserRepository;
use App\Domain\Entities\User;
use App\Domain\ValueObjects\Username;

final readonly class CreateOperatorService
{
    public function __construct(private UserRepository $users, private PasswordHasher $passwords, private IdGenerator $ids) {}

    public function create(string $actorRole, string $username, #[\SensitiveParameter] string $password, string $role): User
    {
        if ($actorRole !== 'admin') {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }
        if ($role !== 'operator') {
            throw new SecurityFailure('VALIDATION_ERROR', 422, 'Solo se permite registrar operadores.');
        }
        $name = new Username($username);
        if ($this->users->findByUsername($name->value) !== null) {
            throw new SecurityFailure('USERNAME_TAKEN', 409, 'El nombre de usuario ya está registrado.');
        }
        $user = new User($this->ids->generate(), $name, 'operator', $this->passwords->hash($password));
        $this->users->create($user);

        return $user;
    }
}
