<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\ListCategoriesService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(ListCategoriesService $service): JsonResponse
    {
        return response()->json($service->list());
    }
}
