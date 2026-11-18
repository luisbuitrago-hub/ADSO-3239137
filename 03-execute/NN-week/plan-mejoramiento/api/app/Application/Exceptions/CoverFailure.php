<?php

namespace App\Application\Exceptions;

final class CoverFailure extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
