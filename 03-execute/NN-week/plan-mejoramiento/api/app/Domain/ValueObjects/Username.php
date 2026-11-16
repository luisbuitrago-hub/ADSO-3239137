<?php

namespace App\Domain\ValueObjects;

final readonly class Username
{
    public string $value;

    public function __construct(string $value)
    {
        $normalized = self::normalize($value);
        if ($normalized === '' || mb_strlen($normalized) > 120) {
            throw new \InvalidArgumentException('El nombre de usuario debe contener entre 1 y 120 caracteres.');
        }
        $this->value = $normalized;
    }

    public static function normalize(string $value): string
    {
        return mb_strtolower(trim($value), 'UTF-8');
    }
}
