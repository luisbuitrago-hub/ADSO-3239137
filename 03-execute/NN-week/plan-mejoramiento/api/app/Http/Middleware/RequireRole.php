<?php

namespace App\Http\Middleware;

use App\Application\Exceptions\SecurityFailure;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        // Autorizar con el rol vigente en persistencia, nunca con datos enviados por el cliente.
        if (! in_array($request->user('api')?->role, $roles, true)) {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }

        return $next($request);
    }
}
