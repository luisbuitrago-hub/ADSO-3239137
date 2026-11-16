<?php

namespace App\Application\Services;

use App\Application\Ports\ArticleRepository;
use App\Domain\Entities\Article;
use App\Domain\Exceptions\CatalogViolation;

final readonly class SearchArticlesService
{
    public function __construct(private ArticleRepository $articles) {}

    public function search(?string $query, ?string $categoryId, int $page = 1, int $size = 20): array
    {
        if ($page < 1 || $page > 2147483647 || $size < 1 || $size > 50) {
            throw new CatalogViolation('VALIDATION_ERROR', 'Los parámetros de paginación no son válidos.');
        }
        $result = $this->articles->search($query, $categoryId, $page, $size);

        return ['items' => array_map(fn (Article $article) => $article->publicData(), $result['items']),
            'page' => $page, 'size' => $size, 'total' => $result['total']];
    }
}
