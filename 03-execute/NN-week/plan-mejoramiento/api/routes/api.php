<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'status' => 'ok',
        ]);
    });

    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::post('/users', [UserController::class, 'store'])->middleware(['bearer', 'role:admin']);
});
