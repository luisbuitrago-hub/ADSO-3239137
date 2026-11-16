<?php

namespace App\Domain\Entities;

final readonly class Category
{
    public function __construct(public string $id, public string $name) {}

    public function publicData(): array
    {
        return ['id' => $this->id, 'name' => $this->name];
    }
}
