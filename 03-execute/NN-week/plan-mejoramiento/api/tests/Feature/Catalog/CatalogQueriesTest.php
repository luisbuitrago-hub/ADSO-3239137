<?php

namespace Tests\Feature\Catalog;

use Tests\Support\CatalogTestCase;

class CatalogQueriesTest extends CatalogTestCase
{
    public function test_categories_have_exact_identifiers_and_are_sorted_by_name(): void
    {
        $this->authenticate('operator');
        $this->getJson('/api/v1/categories')->assertOk()->assertExactJson([
            ['id' => '33333333-3333-4333-8333-333333333333', 'name' => 'cubiertos'],
            ['id' => '44444444-4444-4444-8444-444444444444', 'name' => 'hornillas'],
            ['id' => '55555555-5555-4555-8555-555555555555', 'name' => 'manteles'],
            ['id' => self::POTS, 'name' => 'ollas'], ['id' => self::DISHES, 'name' => 'vajilla'],
        ]);
    }

    public function test_search_matches_name_or_description_and_combines_category_and_active_filters(): void
    {
        $this->authenticate('operator');
        $first = $this->storedArticle(['name' => 'Olla A', 'description' => 'Titanio']);
        $second = $this->storedArticle(['reference' => 'OLL-002', 'name' => 'Cacerola B', 'description' => 'Olla de aluminio']);
        $this->storedArticle(['reference' => 'VAJ-001', 'category_id' => self::DISHES, 'name' => 'Olla de vajilla']);
        $this->storedArticle(['reference' => 'OLD-001', 'name' => 'Olla borrada', 'deleted_at' => '2026-11-14 00:00:00']);
        $this->getJson('/api/v1/articles?q=OLLA&category_id='.self::POTS)->assertOk()
            ->assertJsonPath('total', 2)->assertJsonPath('items.0.id', $second['id'])->assertJsonPath('items.1.id', $first['id']);
        $this->getJson('/api/v1/articles?q=Titanio')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/v1/articles?q=OLL-001')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_pagination_returns_totals_defaults_and_at_most_fifty_items(): void
    {
        $this->authenticate();
        for ($i = 0; $i < 53; $i++) {
            $this->storedArticle(['reference' => 'REF-'.$i, 'name' => sprintf('Artículo %03d', $i)]);
        }
        $this->getJson('/api/v1/articles')->assertOk()->assertJsonCount(20, 'items')->assertJsonPath('page', 1)->assertJsonPath('size', 20)->assertJsonPath('total', 53);
        $this->getJson('/api/v1/articles?page=2&size=50')->assertOk()->assertJsonCount(3, 'items')->assertJsonPath('items.0.name', 'Artículo 050')->assertJsonPath('total', 53);
        $this->getJson('/api/v1/articles?page=100&size=50')->assertOk()->assertJsonCount(0, 'items')->assertJsonPath('total', 53);
        $this->getJson('/api/v1/articles?q=sin-resultados')->assertExactJson(['items' => [], 'page' => 1, 'size' => 20, 'total' => 0]);
    }

    public function test_detail_uses_the_exact_contract_and_inactive_articles_are_not_found(): void
    {
        $this->authenticate();
        $article = $this->storedArticle();
        $this->getJson('/api/v1/articles/'.$article['id'])->assertOk()->assertExactJson([
            'id' => $article['id'], 'name' => 'Olla grande', 'description' => 'Olla de aluminio', 'reference' => 'OLL-001',
            'category' => ['id' => self::POTS, 'name' => 'ollas'], 'total_units' => 5, 'available_units' => 5, 'cover_key' => null,
        ]);
        $deleted = $this->storedArticle(['reference' => 'OLD', 'deleted_at' => '2026-11-14 00:00:00']);
        foreach ([$deleted['id'], 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'invalid-id'] as $id) {
            $this->getJson('/api/v1/articles/'.$id)->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
        }
    }

    public function test_wildcards_are_literal_and_search_values_cannot_change_sql(): void
    {
        $this->authenticate();
        $this->storedArticle(['name' => 'Olla 100%_especial!']);
        $this->storedArticle(['reference' => 'OTHER', 'name' => 'Otro artículo']);
        foreach (['%', '_', '!'] as $query) {
            $this->getJson('/api/v1/articles?q='.urlencode($query))->assertOk()->assertJsonPath('total', 1);
        }
        $this->getJson('/api/v1/articles?q='.urlencode("' OR 1=1 --"))->assertOk()->assertJsonPath('total', 0);
    }

    public function test_invalid_filters_and_pagination_use_uniform_validation_errors(): void
    {
        $this->authenticate();
        foreach (['page=0', 'page=-1', 'page=abc', 'size=0', 'size=51', 'size=2.5', 'category_id=invalid', 'q[]=invalid'] as $query) {
            $response = $this->getJson('/api/v1/articles?'.$query)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
            $this->assertSame(['code', 'message', 'details'], array_keys($response->json()));
        }
        $this->getJson('/api/v1/articles?category_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->assertOk()->assertJsonPath('total', 0);
    }
}
