<?php

namespace Tests\Feature\Neighbors;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPOpenSourceSaver\JWTAuth\JWT;
use Tests\Support\NeighborTestCase;

class NeighborQueriesTest extends NeighborTestCase
{
    public function test_search_matches_partial_names_and_documents_with_deterministic_pagination(): void
    {
        $this->authenticate('operator');
        $ana = $this->neighbor(['full_name' => 'Ana Perez', 'document_number' => '00123-A']);
        $bea = $this->neighbor(['full_name' => 'Beatriz', 'document_number' => 'PREFIX-PEREZ']);
        $this->neighbor(['full_name' => 'Zoe', 'document_number' => 'OTHER']);
        $this->getJson('/api/v1/neighbors?q=pErEz&page=2&size=1')->assertOk()->assertExactJson([
            'items' => [$bea], 'page' => 2, 'size' => 1, 'total' => 2,
        ]);
        $this->getJson('/api/v1/neighbors?q=0123')->assertOk()->assertExactJson(['items' => [$ana], 'page' => 1, 'size' => 20, 'total' => 1]);
    }

    public function test_pagination_defaults_limit_and_empty_pages(): void
    {
        $this->authenticate();
        for ($i = 0; $i < 53; $i++) {
            $this->neighbor(['full_name' => sprintf('Vecino %03d', $i), 'document_number' => (string) $i]);
        }
        $this->getJson('/api/v1/neighbors')->assertOk()->assertJsonCount(20, 'items')->assertJsonPath('page', 1)->assertJsonPath('size', 20)->assertJsonPath('total', 53);
        $this->getJson('/api/v1/neighbors?page=2&size=50')->assertOk()->assertJsonCount(3, 'items')->assertJsonPath('items.0.full_name', 'Vecino 050')->assertJsonPath('total', 53);
        $this->getJson('/api/v1/neighbors?page=100')->assertJsonCount(0, 'items')->assertJsonPath('total', 53);
        $this->getJson('/api/v1/neighbors?q=no-match')->assertExactJson(['items' => [], 'page' => 1, 'size' => 20, 'total' => 0]);
    }

    public function test_invalid_filters_return_uniform_validation_errors(): void
    {
        $this->authenticate();
        foreach (['page=0', 'page=-1', 'page=abc', 'page=2.5', 'size=0', 'size=51', 'size[]=1', 'q[]=name'] as $query) {
            $this->getJson('/api/v1/neighbors?'.$query)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
    }

    public function test_search_escapes_literal_wildcards_and_sql_input(): void
    {
        $this->authenticate();
        $this->neighbor(['full_name' => 'Nombre 100%_!', 'document_number' => '001']);
        $this->neighbor(['full_name' => 'Otro', 'document_number' => '002']);
        foreach (['%', '_', '!'] as $query) {
            $this->getJson('/api/v1/neighbors?q='.urlencode($query))->assertOk()->assertJsonPath('total', 1);
        }
        $this->getJson('/api/v1/neighbors?q='.urlencode("' OR 1=1 --"))->assertOk()->assertJsonPath('total', 0);
    }

    public function test_detail_counts_pending_items_across_loans_including_overdue_and_preserves_data(): void
    {
        $this->authenticate();
        $neighbor = $this->neighbor();
        $other = $this->neighbor(['document_number' => 'other']);
        $this->loanFor($neighbor['id'], [false, false, true]);
        $this->loanFor($neighbor['id'], [false]);
        $this->loanFor($neighbor['id'], [true, true]);
        $this->loanFor($other['id'], [false, false]);
        $loans = DB::table('loan')->orderBy('id')->get()->toJson();
        $items = DB::table('loan_item')->orderBy('id')->get()->toJson();
        $this->getJson('/api/v1/neighbors/'.$neighbor['id'])->assertOk()->assertExactJson($neighbor + ['active_loans' => 3]);
        $this->getJson('/api/v1/neighbors/'.$other['id'])->assertJsonPath('active_loans', 2);
        $this->assertSame($loans, DB::table('loan')->orderBy('id')->get()->toJson());
        $this->assertSame($items, DB::table('loan_item')->orderBy('id')->get()->toJson());
    }

    public function test_neighbors_without_loans_and_with_only_returns_have_zero_pending(): void
    {
        $this->authenticate('operator');
        $neighbor = $this->neighbor();
        $this->getJson('/api/v1/neighbors/'.$neighbor['id'])->assertJsonPath('active_loans', 0);
        $this->loanFor($neighbor['id'], [true, true]);
        $this->getJson('/api/v1/neighbors/'.$neighbor['id'])->assertJsonPath('active_loans', 0);
    }

    public function test_unknown_or_invalid_identifiers_are_not_found_without_postgresql_errors(): void
    {
        $this->authenticate();
        foreach ([(string) Str::uuid(), 'invalid'] as $id) {
            $this->getJson('/api/v1/neighbors/'.$id)->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
        }
    }

    public function test_all_three_endpoints_require_bearer_authentication(): void
    {
        $neighbor = $this->neighbor();
        $this->getJson('/api/v1/neighbors')->assertUnauthorized();
        $this->getJson('/api/v1/neighbors/'.$neighbor['id'])->assertUnauthorized();
        $this->postJson('/api/v1/neighbors', [])->assertUnauthorized()->assertJsonPath('code', 'INVALID_CREDENTIALS');
    }

    public function test_other_roles_are_forbidden_before_validation_or_resource_lookup(): void
    {
        $user = $this->user('other', 'other');
        $this->withToken(app(JWT::class)->fromUser($user));
        $this->getJson('/api/v1/neighbors')->assertForbidden();
        $this->getJson('/api/v1/neighbors/'.Str::uuid())->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
        $this->postJson('/api/v1/neighbors', [])->assertForbidden();
    }

    public function test_update_and_delete_endpoints_are_not_added(): void
    {
        $this->authenticate();
        $neighbor = $this->neighbor();
        $this->putJson('/api/v1/neighbors/'.$neighbor['id'], ['full_name' => 'No cambiar'])->assertStatus(405);
        $this->deleteJson('/api/v1/neighbors/'.$neighbor['id'])->assertStatus(405);
        $this->assertSame($neighbor, (array) DB::table('neighbor')->first());
    }
}
