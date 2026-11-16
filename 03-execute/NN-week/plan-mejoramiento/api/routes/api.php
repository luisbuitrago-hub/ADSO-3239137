<?php

use App\Http\Controllers\Api\V1\ArticleController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
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

    Route::middleware(['bearer', 'role:admin,operator'])->group(function (): void {
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::get('/articles', [ArticleController::class, 'index']);
        Route::get('/articles/{id}', [ArticleController::class, 'show'])->whereUuid('id');
    });

    Route::middleware(['bearer', 'role:admin'])->group(function (): void {
        Route::post('/articles', [ArticleController::class, 'store']);
        Route::put('/articles/{id}', [ArticleController::class, 'update'])->whereUuid('id');
        Route::delete('/articles/{id}', [ArticleController::class, 'destroy'])->whereUuid('id');
    });
});
