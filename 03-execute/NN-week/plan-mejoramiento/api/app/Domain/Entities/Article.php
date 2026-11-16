<?php

namespace App\Domain\Entities;

use App\Domain\Exceptions\CatalogViolation;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\Quantity;
use DateTimeImmutable;

final class Article
{
    public function __construct(
        public readonly string $id,
        private string $name,
        private string $description,
        public readonly ArticleReference $reference,
        private Category $category,
        private Quantity $total,
        private Quantity $available,
        private readonly ?string $coverKey = null,
        private ?DateTimeImmutable $deletedAt = null,
    ) {
        $this->validate($name, $description, $total, $available);
    }

    public function update(string $name, string $description, Category $category, Quantity $total): void
    {
        $available = new Quantity($this->available->value + $total->value - $this->total->value);
        $this->validate($name, $description, $total, $available);
        $this->name = $name;
        $this->description = $description;
        $this->category = $category;
        $this->total = $total;
        $this->available = $available;
    }

    public function deactivate(DateTimeImmutable $at, bool $hasOpenLoans): void
    {
        if ($hasOpenLoans) {
            throw new CatalogViolation('ARTICLE_HAS_OPEN_LOANS', 'El artículo tiene préstamos pendientes de devolución.');
        }
        $this->deletedAt = $at;
    }

    public function deletedAt(): ?DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function publicData(): array
    {
        return [
            'id' => $this->id, 'name' => $this->name, 'description' => $this->description,
            'reference' => $this->reference->value, 'category' => $this->category->publicData(),
            'total_units' => $this->total->value, 'available_units' => $this->available->value,
            'cover_key' => $this->coverKey,
        ];
    }

    private function validate(string $name, string $description, Quantity $total, Quantity $available): void
    {
        if (trim($name) === '' || mb_strlen($name) > 250 || trim($description) === '' || mb_strlen($description) > 200) {
            throw new CatalogViolation('VALIDATION_ERROR', 'El nombre o la descripción del artículo no son válidos.');
        }
        if ($total->value < 1 || $available->value > $total->value) {
            throw new CatalogViolation('VALIDATION_ERROR', 'Las unidades disponibles deben estar entre cero y el total, y el total debe ser positivo.');
        }
    }
}
