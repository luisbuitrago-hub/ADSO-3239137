<?php

namespace App\Infrastructure\Persistence;

use App\Application\Ports\CategoryRepository;
use App\Domain\Entities\Category;
use App\Models\Category as CategoryModel;

final class EloquentCategoryRepository implements CategoryRepository
{
    public function all(): array
    {
        return CategoryModel::orderBy('name')->orderBy('id')->get()
            ->map(fn (CategoryModel $model) => new Category($model->id, $model->name))->all();
    }

    public function find(string $id): ?Category
    {
        $model = CategoryModel::find($id);

        return $model === null ? null : new Category($model->id, $model->name);
    }
}
