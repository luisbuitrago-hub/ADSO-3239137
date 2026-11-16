<?php

namespace App\Domain\Exceptions;

final class CatalogViolation extends \DomainException
{
    public function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }
}
