<?php

namespace App\Application\Ports;

use App\Domain\Entities\User;

interface UserRepository
{
    public function findByUsername(string $username): ?User;

    public function findAdministrator(): ?User;

    public function create(User $user): void;
}
