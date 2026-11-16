<?php

namespace App\Application\Services;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Ports\ArticleRepository;
use App\Domain\Entities\Article;

final readonly class GetArticleService
{
    public function __construct(private ArticleRepository $articles) {}

    public function get(string $id): Article
    {
        return $this->articles->findActive($id)
            ?? throw new CatalogFailure('NOT_FOUND', 404, 'El artículo solicitado no existe.');
    }
}
