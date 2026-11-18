<?php

namespace App\Application\Ports;

use App\Domain\ValueObjects\CoverImage;

interface ImageInspector
{
    public function inspect(string $contents): CoverImage;
}
