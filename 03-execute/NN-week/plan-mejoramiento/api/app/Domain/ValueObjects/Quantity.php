<?php

namespace App\Domain\ValueObjects;

use App\Domain\Exceptions\CatalogViolation;

final readonly class Quantity
{
    public function __construct(public int $value)
    {
        if ($value < 0 || $value > 2147483647) {
            throw new CatalogViolation('VALIDATION_ERROR', 'La cantidad debe ser un entero entre cero y 2147483647.');
        }
    }
}
