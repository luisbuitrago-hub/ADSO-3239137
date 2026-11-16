<?php

namespace App\Domain\ValueObjects;

use App\Domain\Exceptions\CatalogViolation;

final readonly class ArticleReference
{
    public function __construct(public string $value)
    {
        if (trim($value) === '' || mb_strlen($value) > 50) {
            throw new CatalogViolation('VALIDATION_ERROR', 'La referencia debe contener entre 1 y 50 caracteres.');
        }
    }
}
