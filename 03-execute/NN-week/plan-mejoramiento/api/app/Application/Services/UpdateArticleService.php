<?php

namespace App\Application\Services;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\CategoryRepository;
use App\Application\Ports\TransactionManager;
use App\Domain\Entities\Article;
use App\Domain\Exceptions\CatalogViolation;
use App\Domain\ValueObjects\Quantity;

final readonly class UpdateArticleService
{
    public function __construct(private ArticleRepository $articles, private CategoryRepository $categories, private TransactionManager $transactions) {}

    public function update(string $actorRole, string $id, array $changes): Article
    {
        if ($actorRole !== 'admin') {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }

        return $this->transactions->run(function () use ($id, $changes): Article {
            $article = $this->articles->findActive($id, forUpdate: true)
                ?? throw new CatalogFailure('NOT_FOUND', 404, 'El artículo solicitado no existe.');
            $current = $article->publicData();
            if (isset($changes['reference']) && $changes['reference'] !== $current['reference']) {
                throw new CatalogViolation('VALIDATION_ERROR', 'La referencia del artículo no puede modificarse.');
            }
            $category = $this->categories->find($changes['category_id'] ?? $current['category']['id'])
                ?? throw new CatalogFailure('VALIDATION_ERROR', 422, 'La categoría indicada no existe.');
            $article->update($changes['name'] ?? $current['name'], $changes['description'] ?? $current['description'],
                $category, new Quantity((int) ($changes['total_units'] ?? $current['total_units'])));
            $this->articles->save($article);

            return $article;
        });
    }
}
