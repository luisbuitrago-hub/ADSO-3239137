<?php

namespace App\Domain\ValueObjects;

use InvalidArgumentException;

final readonly class CoverImage
{
    public const MAX_BYTES = 2097152;

    public function __construct(public string $contents, public string $mimeType)
    {
        if ($contents === '' || strlen($contents) > self::MAX_BYTES || ! in_array($mimeType, ['image/jpeg', 'image/png'], true)) {
            throw new InvalidArgumentException('La imagen debe ser JPG o PNG y no superar 2 MB.');
        }
    }

    public function extension(): string
    {
        return $this->mimeType === 'image/png' ? 'png' : 'jpg';
    }
}
