<?php

namespace App\Http\Controllers\Api\V1;

use App\Application\Services\LoginService;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function login(LoginRequest $request, LoginService $service): JsonResponse
    {
        $data = $request->validated();

        return response()->json($service->login($data['username'], $data['password']));
    }
}
