<?php

namespace App\Application\Exceptions;

final class CatalogFailure extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}
