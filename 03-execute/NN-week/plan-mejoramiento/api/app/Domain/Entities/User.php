<?php

namespace App\Domain\Entities;

use App\Domain\ValueObjects\Username;

final readonly class User
{
    public function __construct(
        public string $id,
        public Username $username,
        public string $role,
        #[\SensitiveParameter] private string $passwordHash,
    ) {
        if (! in_array($role, ['admin', 'operator'], true)) {
            throw new \InvalidArgumentException('El rol no está permitido.');
        }
    }

    public function passwordHash(): string
    {
        return $this->passwordHash;
    }

    public function publicData(): array
    {
        return ['id' => $this->id, 'username' => $this->username->value, 'role' => $this->role];
    }
}
