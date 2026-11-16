<?php

namespace App\Application\Services;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\CategoryRepository;
use App\Application\Ports\IdGenerator;
use App\Domain\Entities\Article;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\Quantity;

final readonly class CreateArticleService
{
    public function __construct(private ArticleRepository $articles, private CategoryRepository $categories, private IdGenerator $ids) {}

    public function create(string $actorRole, array $data): Article
    {
        if ($actorRole !== 'admin') {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }
        $reference = new ArticleReference($data['reference']);
        $category = $this->categories->find($data['category_id'])
            ?? throw new CatalogFailure('VALIDATION_ERROR', 422, 'La categoría indicada no existe.');
        if ($this->articles->referenceTaken($reference->value)) {
            throw new CatalogFailure('REFERENCE_TAKEN', 409, 'La referencia ya pertenece a un artículo activo.');
        }
        $quantity = new Quantity((int) $data['total_units']);
        $article = new Article($this->ids->generate(), $data['name'], $data['description'], $reference, $category, $quantity, $quantity);
        $this->articles->create($article);

        return $article;
    }
}
