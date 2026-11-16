<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateBearer
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if (! $token) {
            throw new AuthenticationException;
        }
        $guard = Auth::guard('api');
        $guard->forgetUser();
        try {
            $guard->setToken($token);
            $user = $guard->user();
        } catch (JWTException) {
            throw new AuthenticationException;
        }
        if ($user === null) {
            throw new AuthenticationException;
        }
        Auth::shouldUse('api');

        return $next($request);
    }
}
