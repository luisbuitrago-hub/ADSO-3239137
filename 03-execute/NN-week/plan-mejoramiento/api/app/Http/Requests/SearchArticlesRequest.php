<?php

namespace App\Http\Requests;

class SearchArticlesRequest extends ArticleRequest
{
    public function rules(): array
    {
        return ['q' => ['sometimes', 'nullable', 'string'], 'category_id' => ['sometimes', 'uuid:4'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
            'size' => ['sometimes', 'integer', 'min:1', 'max:50']];
    }
}
