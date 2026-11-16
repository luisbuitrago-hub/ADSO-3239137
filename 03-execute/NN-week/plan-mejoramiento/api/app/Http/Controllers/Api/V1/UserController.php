<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\CreateOperatorService;
use App\Http\Controllers\Controller;
use App\Http\Requests\CreateOperatorRequest;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{
    public function store(CreateOperatorRequest $request, CreateOperatorService $service): JsonResponse
    {
        $data = $request->validated();
        $user = $service->create($request->user('api')->role, $data['username'], $data['password'], $data['role']);

        return response()->json($user->publicData(), 201);
    }
}
