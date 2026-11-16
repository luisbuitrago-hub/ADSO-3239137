<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\CreateNeighborService;
use App\Application\Services\GetNeighborService;
use App\Application\Services\SearchNeighborsService;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateNeighborRequest;
use App\Http\Requests\SearchNeighborsRequest;
use Illuminate\Http\JsonResponse;

class NeighborController extends Controller
{
    public function index(SearchNeighborsRequest $request, SearchNeighborsService $service): JsonResponse
    {
        $data = $request->validated();

        return response()->json($service->search($data['q'] ?? null, (int) ($data['page'] ?? 1), (int) ($data['size'] ?? 20)));
    }

    public function show(string $id, GetNeighborService $service): JsonResponse
    {
        return response()->json($service->get($id));
    }

    public function store(CreateNeighborRequest $request, CreateNeighborService $service): JsonResponse
    {
        $data = $request->validated();
        $neighbor = $service->create($request->user('api')->role, $data['full_name'], $data['document_number']);

        return response()->json($neighbor->publicData(), 201);
    }
}
