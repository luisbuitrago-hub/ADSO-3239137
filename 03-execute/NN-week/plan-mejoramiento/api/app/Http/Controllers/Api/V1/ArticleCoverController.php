<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\ArticleCoverService;
use App\Http\Controllers\Controller;
use App\Http\Requests\UploadCoverRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ArticleCoverController extends Controller
{
    public function store(UploadCoverRequest $request, string $id, ArticleCoverService $service): JsonResponse
    {
        return response()->json($service->put($request->user('api')->role, strtolower($id), $request->file('file')->getContent()));
    }

    public function show(string $id, ArticleCoverService $service): Response
    {
        $image = $service->get(strtolower($id));

        return response($image->contents, 200, ['Content-Type' => $image->mimeType, 'Content-Length' => strlen($image->contents),
            'Content-Disposition' => 'inline; filename="cover.'.$image->extension().'"',
            'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
    }

    public function destroy(Request $request, string $id, ArticleCoverService $service): Response
    {
        $service->delete($request->user('api')->role, strtolower($id));

        return response()->noContent();
    }
}
