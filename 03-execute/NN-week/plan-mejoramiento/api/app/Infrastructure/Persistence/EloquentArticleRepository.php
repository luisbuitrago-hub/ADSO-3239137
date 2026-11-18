<?php

namespace App\Infrastructure\Persistence;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Ports\ArticleRepository;
use App\Domain\Entities\Article;
use App\Domain\Entities\Category;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\Quantity;
use App\Models\Article as ArticleModel;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final class EloquentArticleRepository implements ArticleRepository
{
    public function findActive(string $id, bool $forUpdate = false): ?Article
    {
        $query = ArticleModel::with('category')->whereKey($id);
        if ($forUpdate) {
            $query->lockForUpdate();
        }
        $model = $query->first();

        return $model === null ? null : $this->toDomain($model);
    }

    public function search(?string $query, ?string $categoryId, int $page, int $size): array
    {
        $builder = ArticleModel::with('category');
        if ($query !== null && $query !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query).'%';
            $operator = DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
            $builder->whereRaw("(name $operator ? ESCAPE '!' OR description $operator ? ESCAPE '!')", [$pattern, $pattern]);
        }
        if ($categoryId !== null) {
            $builder->where('category_id', $categoryId);
        }
        $total = (clone $builder)->count();
        $items = $builder->orderBy('name')->orderBy('id')->offset(($page - 1) * $size)->limit($size)->get()
            ->map(fn (ArticleModel $model) => $this->toDomain($model))->all();

        return ['items' => $items, 'total' => $total];
    }

    public function findIncludingInactive(string $id, bool $forUpdate = false): ?Article
    {
        $query = ArticleModel::withTrashed()->with('category')->whereKey($id);
        if ($forUpdate) {
            $query->lockForUpdate();
        }
        $model = $query->first();

        return $model === null ? null : $this->toDomain($model);
    }

    public function referenceTaken(string $reference): bool
    {
        return ArticleModel::where('reference', $reference)->exists();
    }

    public function create(Article $article): void
    {
        $data = $article->publicData();
        try {
            DB::transaction(function () use ($data): void {
                $model = new ArticleModel;
                $model->id = $data['id'];
                $model->fill([
                    'name' => $data['name'], 'description' => $data['description'], 'reference' => $data['reference'],
                    'category_id' => $data['category']['id'], 'total_units' => $data['total_units'],
                    'available_units' => $data['available_units'],
                ]);
                $model->save();
            });
        } catch (UniqueConstraintViolationException $exception) {
            if (str_contains($exception->getMessage(), 'ux_article_active_reference')
                || str_contains($exception->getMessage(), 'article.reference')) {
                throw new CatalogFailure('REFERENCE_TAKEN', 409, 'La referencia ya pertenece a un artículo activo.');
            }
            throw $exception;
        }
    }

    public function save(Article $article): void
    {
        $data = $article->publicData();
        ArticleModel::withTrashed()->whereKey($article->id)->update([
            'name' => $data['name'], 'description' => $data['description'],
            'category_id' => $data['category']['id'], 'total_units' => $data['total_units'],
            'available_units' => $data['available_units'], 'deleted_at' => $article->deletedAt(),
        ]);
    }

    public function hasOpenLoans(string $articleId): bool
    {
        return DB::table('loan_item')->where('article_id', $articleId)->whereNull('returned_at')->exists();
    }

    public function setCoverKey(string $id, ?string $key): void
    {
        if (ArticleModel::whereKey($id)->update(['cover_key' => $key]) !== 1) {
            throw new CatalogFailure('NOT_FOUND', 404, 'El artículo solicitado no existe.');
        }
    }

    private function toDomain(ArticleModel $model): Article
    {
        return new Article($model->id, $model->name, $model->description, new ArticleReference($model->reference),
            new Category($model->category->id, $model->category->name), new Quantity($model->total_units),
            new Quantity($model->available_units), $model->cover_key, $model->deleted_at?->toDateTimeImmutable());
    }
}
