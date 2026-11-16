<?php

use App\Application\Exceptions\SecurityFailure;
use App\Http\Middleware\AuthenticateBearer;
use App\Http\Middleware\RequireRole;
use App\Http\Responses\ApiExceptionRenderer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['bearer' => AuthenticateBearer::class, 'role' => RequireRole::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport(SecurityFailure::class);
        $exceptions->dontFlash(['password', 'password_hash', 'current_password', 'password_confirmation']);
        $exceptions->render(fn (Throwable $exception, Request $request) => app(ApiExceptionRenderer::class)->render($exception, $request));
        $exceptions->report(function (Throwable $exception) {
            if (request()->is('api/*')) {
                // No registrar SQL, bindings, tokens ni trazas con argumentos sensibles.
                Log::error('Error interno de la API.', ['exception' => $exception::class]);

                return false;
            }
        });
    })->create();
