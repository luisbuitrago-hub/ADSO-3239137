<?php

namespace App\Infrastructure\Security;

use App\Application\Ports\PasswordHasher;
use Illuminate\Contracts\Hashing\Hasher;

final readonly class BcryptPasswordHasher implements PasswordHasher
{
    public function __construct(private Hasher $hasher) {}

    public function hash(#[\SensitiveParameter] string $password): string
    {
        if ($password === '' || strlen($password) > 72) {
            throw new \InvalidArgumentException('La contraseña debe contener entre 1 y 72 bytes.');
        }

        return $this->hasher->make($password);
    }

    public function verify(#[\SensitiveParameter] string $password, #[\SensitiveParameter] string $hash): bool
    {
        return strlen($password) <= 72 && $this->hasher->check($password, $hash);
    }
}
