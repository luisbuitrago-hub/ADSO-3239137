<?php

namespace Tests\Feature\Catalog;

use App\Application\Ports\Clock;
use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CatalogTestCase;

class CatalogPermissionsAndDeletionTest extends CatalogTestCase
{
    public function test_all_catalog_endpoints_require_authentication(): void
    {
        $article = $this->storedArticle();
        foreach ([['GET', '/categories'], ['GET', '/articles'], ['GET', '/articles/'.$article['id']],
            ['POST', '/articles'], ['PUT', '/articles/'.$article['id']], ['DELETE', '/articles/'.$article['id']]] as [$method, $path]) {
            $this->json($method, '/api/v1'.$path)->assertUnauthorized()->assertJsonPath('code', 'INVALID_CREDENTIALS');
        }
    }

    public function test_operator_can_read_but_cannot_write_even_for_nonexistent_resources(): void
    {
        $this->authenticate('operator');
        $article = $this->storedArticle();
        foreach (['/categories', '/articles', '/articles/'.$article['id']] as $path) {
            $this->getJson('/api/v1'.$path)->assertOk();
        }
        $missing = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        $this->postJson('/api/v1/articles', [])->assertForbidden();
        foreach ([$article['id'], $missing] as $id) {
            $this->putJson('/api/v1/articles/'.$id, [])->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
            $this->deleteJson('/api/v1/articles/'.$id)->assertForbidden();
        }
    }

    public function test_pending_lines_block_deactivation_without_changing_the_article(): void
    {
        $this->authenticate();
        $article = $this->storedArticle();
        DB::table('loan_item')->insert(['id' => (string) Str::uuid(), 'article_id' => $article['id'], 'returned_at' => null]);
        $this->deleteJson('/api/v1/articles/'.$article['id'])->assertConflict()->assertExactJson([
            'code' => 'ARTICLE_HAS_OPEN_LOANS', 'message' => 'El artículo tiene préstamos pendientes de devolución.', 'details' => [],
        ]);
        $this->assertNull(DB::table('article')->value('deleted_at'));
        $this->assertSame(1, DB::table('loan_item')->count());
    }

    public function test_returned_lines_allow_soft_deletion_at_the_injected_utc_instant(): void
    {
        $this->authenticate();
        $this->app->instance(Clock::class, new class implements Clock
        {
            public function now(): DateTimeImmutable
            {
                return new DateTimeImmutable('2026-11-15T12:00:00Z');
            }
        });
        $article = $this->storedArticle();
        DB::table('loan_item')->insert(['id' => (string) Str::uuid(), 'article_id' => $article['id'], 'returned_at' => '2026-11-14 12:00:00']);
        $path = '/api/v1/articles/'.$article['id'];
        $this->deleteJson($path)->assertNoContent()->assertContent('');
        $this->assertSame(1, DB::table('article')->count());
        $this->assertSame('2026-11-15 12:00:00', DB::table('article')->value('deleted_at'));
        $this->assertSame(1, DB::table('loan_item')->count());
        $this->getJson($path)->assertNotFound();
        $this->getJson('/api/v1/articles')->assertJsonPath('total', 0);
        $this->putJson($path, ['name' => 'No cambiar'])->assertNotFound();
        $this->deleteJson($path)->assertNotFound();
    }

    public function test_unknown_articles_cannot_be_updated_or_deactivated(): void
    {
        $this->authenticate();
        $path = '/api/v1/articles/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        $this->putJson($path, ['name' => 'Nuevo nombre'])->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
        $this->deleteJson($path)->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
    }
}
