<?php

namespace App\Application\Services;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\PasswordHasher;
use App\Application\Ports\TokenIssuer;
use App\Application\Ports\UserRepository;
use App\Domain\ValueObjects\Username;

final readonly class LoginService
{
    public function __construct(private UserRepository $users, private PasswordHasher $passwords, private TokenIssuer $tokens) {}

    public function login(string $username, #[\SensitiveParameter] string $password): array
    {
        $user = $this->users->findByUsername((new Username($username))->value);
        if ($user === null || ! $this->passwords->verify($password, $user->passwordHash())) {
            throw new SecurityFailure('INVALID_CREDENTIALS', 401, 'Credenciales incorrectas.');
        }

        return [
            'access_token' => $this->tokens->issue($user),
            'token_type' => 'Bearer', 'expires_in' => 28800, 'role' => $user->role,
        ];
    }
}
