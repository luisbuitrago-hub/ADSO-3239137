<?php

namespace App\Domain\ValueObjects;

use App\Domain\Exceptions\NeighborViolation;

final readonly class DocumentNumber
{
    public string $value;

    public function __construct(string $value)
    {
        $normalized = self::normalize($value);
        if ($normalized === '' || mb_strlen($normalized) > 30) {
            throw new NeighborViolation('El documento debe contener entre 1 y 30 caracteres.');
        }
        $this->value = $normalized;
    }

    public static function normalize(string $value): string
    {
        return trim($value);
    }
}
