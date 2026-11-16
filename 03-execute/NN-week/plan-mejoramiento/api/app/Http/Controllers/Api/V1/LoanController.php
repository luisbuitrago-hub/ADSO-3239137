<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\GetLoanService;
use App\Application\Services\LendArticlesService;
use App\Application\Services\ListLoansService;
use App\Application\Services\OverdueLoansService;
use App\Application\Services\ReturnItemService;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateLoanRequest;
use App\Http\Requests\ListLoansRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoanController extends Controller
{
    public function store(CreateLoanRequest $request, LendArticlesService $service): JsonResponse
    {
        $data = $request->validated();
        $actor = $request->user('api');

        return response()->json($service->lend($actor->id, $actor->role, $data['neighbor_id'], array_column($data['items'], 'article_id')), 201);
    }

    public function index(ListLoansRequest $request, ListLoansService $service): JsonResponse
    {
        return response()->json($service->list($request->validated()));
    }

    public function show(string $id, GetLoanService $service): JsonResponse
    {
        return response()->json($service->get(strtolower($id)));
    }

    public function overdue(OverdueLoansService $service): JsonResponse
    {
        return response()->json($service->list());
    }

    public function returnItem(Request $request, string $loan_id, string $item_id, ReturnItemService $service): JsonResponse
    {
        return response()->json($service->returnItem($request->user('api')->role, strtolower($loan_id), strtolower($item_id)));
    }
}
