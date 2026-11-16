<?php

namespace App\Application\Services;

use App\Application\Ports\CategoryRepository;
use App\Domain\Entities\Category;

final readonly class ListCategoriesService
{
    public function __construct(private CategoryRepository $categories) {}

    public function list(): array
    {
        return array_map(fn (Category $category) => $category->publicData(), $this->categories->all());
    }
}
