<?php

namespace Tests\Feature\Auth;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Tests\Support\SecurityTestCase;

class ApiErrorsAndCorsTest extends SecurityTestCase
{
    public function test_unexpected_errors_are_uniform_even_with_debug_enabled_and_logs_are_redacted(): void
    {
        config(['app.debug' => true]);
        Log::spy();
        Route::post('/api/v1/testing-error', function () {
            throw new \RuntimeException('Sensitive fixture that must not appear');
        });
        $this->postJson('/api/v1/testing-error', ['password' => $this->testPassword])->assertStatus(500)->assertExactJson([
            'code' => 'INTERNAL_ERROR', 'message' => 'No fue posible completar la operación.', 'details' => [],
        ]);
        Log::shouldHaveReceived('error')->once()->with('Error interno de la API.', ['exception' => \RuntimeException::class]);
    }

    public function test_expected_errors_do_not_log_credentials_or_hashes(): void
    {
        Log::spy();
        $this->postJson('/api/v1/auth/login', ['username' => 'unknown', 'password' => $this->testPassword])->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', [])->assertUnprocessable();
        $token = $this->tokenFor($this->user());
        $this->withToken($token)->postJson('/api/v1/users', $this->operatorData())->assertCreated();
        $this->withToken($token)->postJson('/api/v1/users', $this->operatorData())->assertConflict();
        Log::shouldNotHaveReceived('error');
        Log::shouldNotHaveReceived('info');
        Log::shouldNotHaveReceived('debug');
    }

    public function test_not_found_and_method_errors_use_contract_format(): void
    {
        $this->get('/api/v1/missing')->assertNotFound()->assertExactJson([
            'code' => 'NOT_FOUND', 'message' => 'El recurso solicitado no existe.', 'details' => [],
        ]);
        $this->getJson('/api/v1/auth/login')->assertStatus(405)->assertJsonPath('code', 'METHOD_NOT_ALLOWED');
    }

    public function test_cors_accepts_only_the_configured_origin_including_error_responses(): void
    {
        config(['cors.allowed_origins' => ['https://kitchenware.example']]);
        $this->withHeaders(['Origin' => 'https://kitchenware.example'])->getJson('/api/v1/health')
            ->assertHeader('Access-Control-Allow-Origin', 'https://kitchenware.example');
        $this->withHeaders(['Origin' => 'https://untrusted.example'])->getJson('/api/v1/health')
            ->assertHeader('Access-Control-Allow-Origin', 'https://kitchenware.example');
        $this->withHeaders(['Origin' => 'https://kitchenware.example'])->postJson('/api/v1/users', [])
            ->assertUnauthorized()->assertHeader('Access-Control-Allow-Origin', 'https://kitchenware.example');
        $this->withHeaders([
            'Origin' => 'https://kitchenware.example', 'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'authorization,content-type',
        ])->options('/api/v1/users')->assertSuccessful()->assertHeader('Access-Control-Allow-Origin', 'https://kitchenware.example');
    }
}
