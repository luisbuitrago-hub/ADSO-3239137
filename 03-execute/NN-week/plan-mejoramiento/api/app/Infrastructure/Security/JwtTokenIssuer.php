<?php

namespace App\Infrastructure\Security;

use App\Application\Ports\TokenIssuer;
use App\Domain\Entities\User;
use App\Models\User as UserModel;
use PHPOpenSourceSaver\JWTAuth\JWT;

final readonly class JwtTokenIssuer implements TokenIssuer
{
    public function __construct(private JWT $jwt) {}

    public function issue(User $user): string
    {
        $subject = new UserModel;
        $subject->id = $user->id;
        $subject->role = $user->role;
        $this->jwt->factory()->setTTL(480);

        return $this->jwt->fromUser($subject);
    }
}
