<?php

namespace App\Application\Ports;

use App\Domain\Entities\User;

interface TokenIssuer
{
    public function issue(User $user): string;
}
