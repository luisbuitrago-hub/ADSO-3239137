<?php

namespace Tests\Feature\Catalog;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CatalogTestCase;

class ArticleWritesTest extends CatalogTestCase
{
    public function test_creation_initializes_inventory_and_assigns_uuid_v4(): void
    {
        $this->authenticate();
        $response = $this->postJson('/api/v1/articles', $this->articleData())->assertCreated()->assertJsonPath('available_units', 5);
        $id = $response->json('id');
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $id);
        $response->assertExactJson(['id' => $id, 'name' => 'Olla grande', 'description' => 'Olla de aluminio', 'reference' => 'OLL-001',
            'category' => ['id' => self::POTS, 'name' => 'ollas'], 'total_units' => 5, 'available_units' => 5, 'cover_key' => null]);
        $this->assertSame(1, DB::table('article')->count());
    }

    public static function invalidArticles(): array
    {
        return [
            'zero' => [['total_units' => 0]], 'negative' => [['total_units' => -1]],
            'fraction' => [['total_units' => 1.5]], 'boolean' => [['total_units' => true]],
            'overflow' => [['total_units' => 2147483648]], 'null' => [['total_units' => null]],
            'text' => [['total_units' => 'invalid']], 'blank name' => [['name' => '   ']],
            'long name' => [['name' => str_repeat('a', 251)]], 'long description' => [['description' => str_repeat('a', 201)]],
            'blank reference' => [['reference' => '']], 'long reference' => [['reference' => str_repeat('a', 51)]],
            'invalid category' => [['category_id' => 'invalid']], 'missing category' => [['category_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']],
        ];
    }

    #[DataProvider('invalidArticles')]
    public function test_invalid_creation_does_not_persist(array $changes): void
    {
        $this->authenticate();
        $this->postJson('/api/v1/articles', $this->articleData($changes))->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        $this->assertSame(0, DB::table('article')->count());
    }

    public function test_missing_required_fields_are_rejected(): void
    {
        $this->authenticate();
        foreach (array_keys($this->articleData()) as $field) {
            $data = $this->articleData();
            unset($data[$field]);
            $this->postJson('/api/v1/articles', $data)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
    }

    public function test_clients_cannot_assign_inventory_identifiers_or_image_fields(): void
    {
        $this->authenticate();
        $article = $this->storedArticle();
        foreach (['id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'available_units' => 0, 'cover_key' => null, 'deleted_at' => null] as $key => $value) {
            $this->postJson('/api/v1/articles', $this->articleData([$key => $value]))->assertUnprocessable();
            $this->putJson('/api/v1/articles/'.$article['id'], [$key => $value])->assertUnprocessable();
        }
        $this->assertSame(5, DB::table('article')->value('available_units'));
    }

    public function test_duplicate_active_references_conflict_and_can_be_reused_after_deactivation(): void
    {
        $this->authenticate();
        $article = $this->storedArticle();
        $this->postJson('/api/v1/articles', $this->articleData())->assertConflict()->assertExactJson([
            'code' => 'REFERENCE_TAKEN', 'message' => 'La referencia ya pertenece a un artículo activo.', 'details' => [],
        ]);
        $this->deleteJson('/api/v1/articles/'.$article['id'])->assertNoContent();
        $this->postJson('/api/v1/articles', $this->articleData())->assertCreated();
        $this->assertSame(2, DB::table('article')->count());
    }

    public function test_total_changes_preserve_borrowed_units_and_inventory_boundaries(): void
    {
        $this->authenticate();
        $article = $this->storedArticle(['available_units' => 2]);
        $path = '/api/v1/articles/'.$article['id'];
        $this->putJson($path, ['total_units' => 7])->assertOk()->assertJsonPath('total_units', 7)->assertJsonPath('available_units', 4);
        $this->putJson($path, ['total_units' => 3])->assertOk()->assertJsonPath('available_units', 0);
        $this->putJson($path, ['total_units' => 2, 'name' => 'No debe guardarse'])->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        $this->assertSame('Olla grande', DB::table('article')->value('name'));
        $this->assertSame(3, DB::table('article')->value('total_units'));
        $this->assertSame(0, DB::table('article')->value('available_units'));
    }

    public function test_metadata_updates_preserve_reference_and_existing_image_key(): void
    {
        $this->authenticate();
        $article = $this->storedArticle(['cover_key' => 'existing-opaque-key']);
        $path = '/api/v1/articles/'.$article['id'];
        $this->putJson($path, ['name' => 'Nuevo nombre', 'description' => 'Otra descripción', 'category_id' => self::DISHES])
            ->assertOk()->assertJsonPath('reference', 'OLL-001')->assertJsonPath('category.name', 'vajilla')->assertJsonPath('cover_key', 'existing-opaque-key');
        $this->putJson($path, ['reference' => 'OTHER'])->assertUnprocessable();
        $this->putJson($path, ['reference' => 'OLL-001'])->assertOk();
        $this->putJson($path, ['category_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])->assertUnprocessable();
        $this->assertSame('OLL-001', DB::table('article')->value('reference'));
    }
}
