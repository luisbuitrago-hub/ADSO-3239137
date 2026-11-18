<?php

namespace App\Application\Ports;

use App\Domain\ValueObjects\CoverImage;

interface CoverStorage
{
    public function put(CoverImage $image): string;

    public function read(string $key): ?string;

    public function delete(string $key): void;
}
