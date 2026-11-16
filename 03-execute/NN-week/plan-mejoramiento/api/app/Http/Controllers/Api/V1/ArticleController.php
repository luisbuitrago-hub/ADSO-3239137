<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\CreateArticleService;
use App\Application\Services\DeactivateArticleService;
use App\Application\Services\GetArticleService;
use App\Application\Services\SearchArticlesService;
use App\Application\Services\UpdateArticleService;
use App\Http\Controllers\Controller;
use App\Http\Requests\ArticleRequest;
use App\Http\Requests\SearchArticlesRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ArticleController extends Controller
{
    public function index(SearchArticlesRequest $request, SearchArticlesService $service): JsonResponse
    {
        $data = $request->validated();

        return response()->json($service->search($data['q'] ?? null, $data['category_id'] ?? null,
            (int) ($data['page'] ?? 1), (int) ($data['size'] ?? 20)));
    }

    public function show(string $id, GetArticleService $service): JsonResponse
    {
        return response()->json($service->get($id)->publicData());
    }

    public function store(ArticleRequest $request, CreateArticleService $service): JsonResponse
    {
        return response()->json($service->create($request->user('api')->role, $request->validated())->publicData(), 201);
    }

    public function update(ArticleRequest $request, string $id, UpdateArticleService $service): JsonResponse
    {
        return response()->json($service->update($request->user('api')->role, $id, $request->validated())->publicData());
    }

    public function destroy(Request $request, string $id, DeactivateArticleService $service): Response
    {
        $service->deactivate($request->user('api')->role, $id);

        return response()->noContent();
    }
}
