<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\MostBorrowedArticlesReportService;
use App\Http\Controllers\Controller;
use App\Http\Requests\MostBorrowedReportRequest;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function mostBorrowed(MostBorrowedReportRequest $request, MostBorrowedArticlesReportService $service): JsonResponse
    {
        $data = $request->validated();

        return response()->json($service->report($request->user('api')->role, $data['from'], $data['to']));
    }
}
