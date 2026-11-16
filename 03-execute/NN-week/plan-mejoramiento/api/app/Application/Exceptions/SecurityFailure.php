<?php

namespace App\Application\Exceptions;

final class SecurityFailure extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
