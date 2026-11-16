<?php

namespace Tests\Integration;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Services\LoginService;
use App\Domain\Entities\Article;
use App\Domain\Entities\Category;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\Quantity;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\Support\PostgresTestCase;

class CatalogPersistenceTest extends PostgresTestCase
{
    private const POTS = '11111111-1111-4111-8111-111111111111';

    private const DISHES = '22222222-2222-4222-8222-222222222222';

    protected function setUp(): void
    {
        parent::setUp();
        config(['jwt.secret' => bin2hex(random_bytes(32)), 'jwt.algo' => 'HS256', 'hashing.bcrypt.rounds' => 4]);
        $user = User::factory()->create(['username' => 'catalog-admin', 'role' => 'admin', 'password_hash' => Hash::driver('bcrypt')->make('Catalog integration fixture!')]);
        $this->withToken(app(LoginService::class)->login($user->username, 'Catalog integration fixture!')['access_token']);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace(['name' => 'Olla grande', 'description' => 'Aluminio', 'reference' => 'OLL-001',
            'category_id' => self::POTS, 'total_units' => 5], $overrides);
    }

    public function test_categories_and_article_crud_follow_contract_on_postgresql(): void
    {
        $this->getJson('/api/v1/categories')->assertOk()->assertJsonCount(5)->assertJsonPath('0.name', 'cubiertos')->assertJsonPath('4.name', 'vajilla');
        $created = $this->postJson('/api/v1/articles', $this->payload())->assertCreated()->assertJsonPath('available_units', 5);
        $id = $created->json('id');
        $this->getJson('/api/v1/articles/'.$id)->assertOk()->assertExactJson($created->json());
        $this->getJson('/api/v1/articles?q=ALUMINIO&category_id='.self::POTS)->assertOk()->assertJsonPath('total', 1)->assertJsonPath('items.0.id', $id);
        $this->putJson('/api/v1/articles/'.$id, ['total_units' => 8])->assertOk()->assertJsonPath('available_units', 8);
        $this->deleteJson('/api/v1/articles/'.$id)->assertNoContent();
        $this->assertNotNull(DB::table('article')->where('id', $id)->value('deleted_at'));
        $this->getJson('/api/v1/articles/'.$id)->assertNotFound();
        $this->getJson('/api/v1/articles')->assertJsonPath('total', 0);
        $this->postJson('/api/v1/articles', $this->payload())->assertCreated();
        $this->assertSame(2, DB::table('article')->count());
    }

    public function test_duplicate_conflicts_and_database_collisions_are_translated_without_aborting_transaction(): void
    {
        $this->postJson('/api/v1/articles', $this->payload())->assertCreated();
        $this->postJson('/api/v1/articles', $this->payload())->assertConflict()->assertJsonPath('code', 'REFERENCE_TAKEN');
        $article = new Article((string) Str::uuid(), 'Otra olla', 'Descripción', new ArticleReference('OLL-001'),
            new Category(self::POTS, 'ollas'), new Quantity(1), new Quantity(1));
        try {
            // La restricción protege también la carrera posterior a la consulta previa.
            app(ArticleRepository::class)->create($article);
            $this->fail('La referencia activa duplicada debe rechazarse.');
        } catch (CatalogFailure $exception) {
            $this->assertSame('REFERENCE_TAKEN', $exception->errorCode);
            $this->assertSame(409, $exception->status);
            $this->assertNull($exception->getPrevious());
        }
        $this->assertSame(1, DB::table('article')->count());
    }

    public function test_inventory_update_and_soft_deletion_preserve_historical_lines(): void
    {
        // Fixtures directas solo en la base temporal; no se implementan préstamos ni devoluciones.
        $item = $this->loanItem();
        DB::table('loan_item')->insert($item);
        DB::table('article')->where('id', $item['article_id'])->update(['available_units' => 1]);
        $historical = (array) DB::table('loan_item')->where('id', $item['id'])->first();
        $path = '/api/v1/articles/'.$item['article_id'];
        $this->putJson($path, ['name' => 'Nuevo nombre', 'category_id' => self::DISHES, 'total_units' => 4])
            ->assertOk()->assertJsonPath('available_units', 3)->assertJsonPath('category.name', 'vajilla');
        $this->assertSame($historical, (array) DB::table('loan_item')->where('id', $item['id'])->first());
        $this->deleteJson($path)->assertConflict()->assertJsonPath('code', 'ARTICLE_HAS_OPEN_LOANS');
        $this->assertNull(DB::table('article')->where('id', $item['article_id'])->value('deleted_at'));
        DB::table('loan_item')->where('id', $item['id'])->update(['returned_at' => '2026-11-15T12:00:00Z']);
        DB::table('article')->where('id', $item['article_id'])->update(['available_units' => 4]);
        $returned = (array) DB::table('loan_item')->where('id', $item['id'])->first();
        $this->deleteJson($path)->assertNoContent();
        $this->assertSame($returned, (array) DB::table('loan_item')->where('id', $item['id'])->first());
        $this->assertSame(1, DB::table('loan')->count());
        $new = $this->postJson('/api/v1/articles', $this->payload())->assertCreated();
        $this->assertNotSame($item['article_id'], $new->json('id'));
        $this->assertSame($item['article_id'], DB::table('loan_item')->value('article_id'));
    }

    public function test_inventory_cannot_be_reduced_below_pending_units_and_metadata_is_rolled_back(): void
    {
        $article = $this->article(['total_units' => 5, 'available_units' => 2]);
        DB::table('article')->insert($article);
        $path = '/api/v1/articles/'.$article['id'];
        $this->putJson($path, ['name' => 'No guardar', 'category_id' => self::DISHES, 'total_units' => 2])->assertUnprocessable();
        $row = DB::table('article')->where('id', $article['id'])->first();
        $this->assertSame($article['name'], $row->name);
        $this->assertSame(self::POTS, $row->category_id);
        $this->assertSame(5, $row->total_units);
        $this->assertSame(2, $row->available_units);
        $this->putJson($path, ['total_units' => 3])->assertOk()->assertJsonPath('available_units', 0);
        $this->putJson($path, ['reference' => 'CHANGED'])->assertUnprocessable();
    }

    public function test_mutations_lock_article_rows_inside_transactions(): void
    {
        $id = $this->postJson('/api/v1/articles', $this->payload())->assertCreated()->json('id');
        $locks = [];
        DB::listen(function (QueryExecuted $query) use (&$locks): void {
            if (str_contains(strtolower($query->sql), 'for update')) {
                $locks[] = $query->connection->transactionLevel();
            }
        });
        $this->putJson('/api/v1/articles/'.$id, ['total_units' => 7])->assertOk();
        $this->deleteJson('/api/v1/articles/'.$id)->assertNoContent();
        $this->assertCount(2, $locks);
        foreach ($locks as $level) {
            $this->assertGreaterThan(1, $level);
        }
    }

    public function test_real_search_filters_orders_and_paginates_active_results(): void
    {
        DB::table('article')->insert($this->article(['name' => 'Zeta olla', 'reference' => 'ZETA']));
        DB::table('article')->insert($this->article(['name' => 'Alfa', 'reference' => 'ALFA', 'description' => 'OLLA pequeña']));
        DB::table('article')->insert($this->article(['name' => 'Olla de vajilla', 'category_id' => self::DISHES, 'reference' => 'OTHER']));
        DB::table('article')->insert($this->article(['name' => 'Olla oculta', 'reference' => 'OLD', 'deleted_at' => '2026-11-15T12:00:00Z']));
        $this->getJson('/api/v1/articles?q=olla&category_id='.self::POTS.'&page=2&size=1')->assertOk()
            ->assertJsonPath('total', 2)->assertJsonCount(1, 'items')->assertJsonPath('items.0.name', 'Zeta olla');
        $this->getJson('/api/v1/articles?q='.urlencode("' OR 1=1 --"))->assertJsonPath('total', 0);
    }

    public function test_search_with_five_thousand_articles_responds_in_less_than_three_hundred_milliseconds(): void
    {
        for ($batch = 0; $batch < 10; $batch++) {
            $rows = [];
            for ($i = 0; $i < 500; $i++) {
                $number = $batch * 500 + $i;
                $rows[] = $this->article(['name' => sprintf('Olla %05d', $number), 'reference' => 'PERF-'.$number]);
            }
            DB::table('article')->insert($rows);
        }
        $started = hrtime(true);
        $response = $this->getJson('/api/v1/articles?q=OLLA&category_id='.self::POTS.'&size=50');
        $elapsed = (hrtime(true) - $started) / 1_000_000;
        $response->assertOk()->assertJsonPath('total', 5000)->assertJsonCount(50, 'items');
        $this->assertLessThan(300, $elapsed, 'La búsqueda HTTP debe responder en menos de 300 ms con 5.000 artículos.');
    }
}
