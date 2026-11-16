<?php

namespace App\Http\Responses;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Domain\Exceptions\CatalogViolation;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ApiExceptionRenderer
{
    public function render(Throwable $exception, Request $request): ?JsonResponse
    {
        if (! $request->is('api/*')) {
            return null;
        }
        $details = [];
        if ($exception instanceof SecurityFailure || $exception instanceof CatalogFailure) {
            [$status, $code, $message] = [$exception->status, $exception->errorCode, $exception->getMessage()];
        } elseif ($exception instanceof CatalogViolation) {
            [$status, $code, $message] = [$exception->errorCode === 'ARTICLE_HAS_OPEN_LOANS' ? 409 : 422,
                $exception->errorCode, $exception->getMessage()];
        } elseif ($exception instanceof ValidationException) {
            [$status, $code, $message] = [422, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.'];
            foreach ($exception->errors() as $field => $issues) {
                foreach ($issues as $issue) {
                    $details[] = ['field' => $field, 'issue' => $issue];
                }
            }
        } elseif ($exception instanceof AuthenticationException) {
            [$status, $code, $message] = [401, 'INVALID_CREDENTIALS', 'Autenticación requerida o token inválido.'];
        } else {
            $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
            [$code, $message] = match ($status) {
                400 => ['BAD_REQUEST', 'La solicitud no es válida.'],
                401 => ['INVALID_CREDENTIALS', 'Autenticación requerida o token inválido.'],
                403 => ['FORBIDDEN_ROLE', 'No tienes permisos para realizar esta operación.'],
                404 => ['NOT_FOUND', 'El recurso solicitado no existe.'],
                405 => ['METHOD_NOT_ALLOWED', 'El método solicitado no está permitido.'],
                429 => ['TOO_MANY_REQUESTS', 'Se han realizado demasiadas solicitudes.'],
                default => ['INTERNAL_ERROR', 'No fue posible completar la operación.'],
            };
        }
        $headers = $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : [];

        return response()->json(['code' => $code, 'message' => $message, 'details' => $details], $status, $headers);
    }
}
