<?php

namespace Tests\Feature;

use Tests\Support\ApiContract;
use Tests\TestCase;

class ApiContractTest extends TestCase
{
    public function test_exact_twenty_one_endpoints_and_role_middleware_match_the_contract(): void
    {
        $actual = [];
        foreach (app('router')->getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/')) {
                continue;
            }
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $key = $method.' '.$route->uri();
                $this->assertArrayHasKey($key, ApiContract::ENDPOINTS);
                $permission = ApiContract::ENDPOINTS[$key];
                $middleware = $route->gatherMiddleware();
                if ($permission === null) {
                    $this->assertNotContains('bearer', $middleware);
                } else {
                    $this->assertContains('bearer', $middleware);
                    $this->assertContains($permission === 'admin' ? 'role:admin' : 'role:admin,operator', $middleware);
                }
                $actual[] = $key;
            }
        }
        $expected = array_keys(ApiContract::ENDPOINTS);
        sort($actual);
        sort($expected);
        $this->assertCount(21, $actual);
        $this->assertSame($expected, $actual);
    }

    public function test_every_protected_endpoint_rejects_missing_tokens_with_uniform_json(): void
    {
        foreach (ApiContract::ENDPOINTS as $endpoint => $permission) {
            if ($permission === null) {
                continue;
            }
            [$method, $path] = explode(' ', $endpoint, 2);
            $path = preg_replace('/\{[^}]+\}/', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $path);
            $this->json($method, '/'.$path)->assertUnauthorized()->assertExactJson([
                'code' => 'INVALID_CREDENTIALS', 'message' => 'Autenticación requerida o token inválido.', 'details' => [],
            ]);
        }
    }

    public function test_local_disks_do_not_register_public_file_routes(): void
    {
        $this->assertFalse(config('filesystems.disks.local.serve'));
        $this->assertFalse(config('filesystems.disks.covers.serve'));
        foreach (app('router')->getRoutes() as $route) {
            $this->assertFalse(str_starts_with($route->uri(), 'storage/'), 'No deben exponerse rutas automáticas de archivos.');
        }
    }
}
