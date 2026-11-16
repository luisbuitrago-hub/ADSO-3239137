<?php

namespace App\Application\Ports;

use App\Domain\Entities\Article;

interface ArticleRepository
{
    public function findActive(string $id, bool $forUpdate = false): ?Article;

    public function findIncludingInactive(string $id, bool $forUpdate = false): ?Article;

    /** @return array{items: list<Article>, total: int} */
    public function search(?string $query, ?string $categoryId, int $page, int $size): array;

    public function referenceTaken(string $reference): bool;

    public function create(Article $article): void;

    public function save(Article $article): void;

    public function hasOpenLoans(string $articleId): bool;
}
