<?php

namespace Tests\Feature\Neighbors;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\NeighborTestCase;

class CreateNeighborTest extends NeighborTestCase
{
    public static function permittedRoles(): array
    {
        return [['admin'], ['operator']];
    }

    #[DataProvider('permittedRoles')]
    public function test_both_roles_register_a_neighbor_with_uuid_v4_and_exact_contract(string $role): void
    {
        $this->authenticate($role);
        $response = $this->postJson('/api/v1/neighbors', ['full_name' => ' Carlos Perez ', 'document_number' => ' 001-A '])->assertCreated();
        $id = $response->json('id');
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $id);
        $response->assertExactJson(['id' => $id, 'full_name' => 'Carlos Perez', 'document_number' => '001-A']);
        $this->assertSame('001-A', DB::table('neighbor')->value('document_number'));
        $this->getJson('/api/v1/neighbors/'.$id)->assertOk()->assertExactJson($response->json() + ['active_loans' => 0]);
    }

    public function test_document_normalization_preserves_zeros_letters_separators_and_case(): void
    {
        $this->authenticate();
        foreach (['000123', 'Ab-01.2', 'ab-01.2', 'AB 01/2'] as $document) {
            $this->postJson('/api/v1/neighbors', ['full_name' => 'Vecino', 'document_number' => ' '.$document.' '])
                ->assertCreated()->assertJsonPath('document_number', $document);
        }
        $this->assertSame(4, DB::table('neighbor')->count());
    }

    public function test_duplicate_document_returns_conflict_without_overwriting_the_neighbor(): void
    {
        $this->authenticate();
        $original = $this->neighbor();
        $this->postJson('/api/v1/neighbors', ['full_name' => 'Otro nombre', 'document_number' => ' 001-A '])->assertConflict()->assertExactJson([
            'code' => 'DOCUMENT_TAKEN', 'message' => 'El documento ya está registrado.', 'details' => [],
        ]);
        $this->assertSame($original, (array) DB::table('neighbor')->first());
    }

    public static function invalidNeighbors(): array
    {
        return [
            'missing name' => [['document_number' => '123']], 'missing document' => [['full_name' => 'Vecino']],
            'blank name' => [['full_name' => '   ', 'document_number' => '123']],
            'blank document' => [['full_name' => 'Vecino', 'document_number' => " \t\n"]],
            'long name' => [['full_name' => str_repeat('ñ', 201), 'document_number' => '123']],
            'long document' => [['full_name' => 'Vecino', 'document_number' => str_repeat('a', 31)]],
            'numeric document' => [['full_name' => 'Vecino', 'document_number' => 123]],
            'boolean document' => [['full_name' => 'Vecino', 'document_number' => true]],
            'array document' => [['full_name' => 'Vecino', 'document_number' => ['123']]],
            'null document' => [['full_name' => 'Vecino', 'document_number' => null]],
            'array name' => [['full_name' => ['Vecino'], 'document_number' => '123']],
            'client identifier' => [['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'full_name' => 'Vecino', 'document_number' => '123']],
            'client pending count' => [['active_loans' => 0, 'full_name' => 'Vecino', 'document_number' => '123']],
        ];
    }

    #[DataProvider('invalidNeighbors')]
    public function test_invalid_input_never_persists_and_uses_uniform_spanish_errors(array $payload): void
    {
        $this->authenticate();
        $response = $this->postJson('/api/v1/neighbors', $payload)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        $this->assertSame(['code', 'message', 'details'], array_keys($response->json()));
        $this->assertNotEmpty($response->json('details'));
        $this->assertSame(0, DB::table('neighbor')->count());
    }

    public function test_maximum_lengths_are_accepted_without_creating_credentials(): void
    {
        $this->authenticate();
        $this->postJson('/api/v1/neighbors', ['full_name' => str_repeat('ñ', 200), 'document_number' => str_repeat('a', 30),
            'username' => 'ignored', 'password' => 'test-only ignored', 'role' => 'admin'])->assertCreated()
            ->assertJsonCount(3)->assertJsonMissingPath('role')->assertJsonMissingPath('password');
        $this->assertSame(1, DB::table('user')->count());
    }
}
