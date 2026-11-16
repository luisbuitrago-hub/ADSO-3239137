<?php

namespace Tests\Integration;

use App\Application\Exceptions\NeighborFailure;
use App\Application\Ports\NeighborRepository;
use App\Application\Services\LoginService;
use App\Domain\Entities\Neighbor;
use App\Domain\ValueObjects\DocumentNumber;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class NeighborPersistenceTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['jwt.secret' => bin2hex(random_bytes(32)), 'jwt.algo' => 'HS256', 'hashing.bcrypt.rounds' => 4]);
    }

    private function authenticate(string $role = 'admin'): void
    {
        $user = User::factory()->create(['username' => 'neighbor-'.$role, 'role' => $role,
            'password_hash' => Hash::driver('bcrypt')->make('Neighbor integration fixture!')]);
        $this->withToken(app(LoginService::class)->login($user->username, 'Neighbor integration fixture!')['access_token']);
    }

    public static function permittedRoles(): array
    {
        return [['admin'], ['operator']];
    }

    #[DataProvider('permittedRoles')]
    public function test_both_roles_register_search_and_read_neighbors_using_real_migrations(string $role): void
    {
        $this->authenticate($role);
        $created = $this->postJson('/api/v1/neighbors', ['full_name' => ' María Perez ', 'document_number' => ' 000Ab-01 '])->assertCreated();
        $id = $created->json('id');
        $created->assertExactJson(['id' => $id, 'full_name' => 'María Perez', 'document_number' => '000Ab-01']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $id);
        $this->getJson('/api/v1/neighbors/'.$id)->assertOk()->assertExactJson($created->json() + ['active_loans' => 0]);
        $this->getJson('/api/v1/neighbors?q=pErEz')->assertOk()->assertExactJson(['items' => [$created->json()], 'page' => 1, 'size' => 20, 'total' => 1]);
        $this->getJson('/api/v1/neighbors?q=00Ab')->assertOk()->assertJsonPath('total', 1);
        $this->assertSame(['id', 'full_name', 'document_number'], DB::getSchemaBuilder()->getColumnListing('neighbor'));
    }

    public function test_normalized_duplicate_is_a_conflict_and_keeps_the_existing_record(): void
    {
        $this->authenticate();
        $first = $this->postJson('/api/v1/neighbors', ['full_name' => 'Original', 'document_number' => '001-A'])->assertCreated()->json();
        $this->postJson('/api/v1/neighbors', ['full_name' => 'Otro nombre', 'document_number' => ' 001-A '])->assertConflict()->assertExactJson([
            'code' => 'DOCUMENT_TAKEN', 'message' => 'El documento ya está registrado.', 'details' => [],
        ]);
        $this->assertSame($first, (array) DB::table('neighbor')->first());
    }

    public function test_database_collision_is_translated_and_preserves_the_outer_transaction(): void
    {
        $neighbor = new Neighbor((string) Str::uuid(), 'Original', new DocumentNumber('001-A'));
        $repository = app(NeighborRepository::class);
        $repository->create($neighbor);
        try {
            // Reproduce la colisión que el motor detecta después de una consulta previa.
            $repository->create(new Neighbor((string) Str::uuid(), 'Otro nombre', new DocumentNumber(' 001-A ')));
            $this->fail('El documento único debe estar protegido por PostgreSQL.');
        } catch (NeighborFailure $exception) {
            $this->assertSame('DOCUMENT_TAKEN', $exception->errorCode);
            $this->assertSame(409, $exception->status);
            $this->assertNull($exception->getPrevious());
        }
        $this->assertSame(1, DB::table('neighbor')->count());
        $this->assertSame($neighbor->publicData(), (array) DB::table('neighbor')->first());
    }

    public function test_real_search_filters_and_paginates_names_documents_and_literal_wildcards(): void
    {
        $this->authenticate('operator');
        for ($i = 0; $i < 53; $i++) {
            DB::table('neighbor')->insert(['id' => (string) Str::uuid(), 'full_name' => sprintf('Vecino %03d', $i), 'document_number' => 'DOC-'.$i]);
        }
        DB::table('neighbor')->insert(['id' => (string) Str::uuid(), 'full_name' => 'Wildcard %_!', 'document_number' => 'SPECIAL']);
        $this->getJson('/api/v1/neighbors?q=VECINO&page=2&size=50')->assertOk()->assertJsonPath('total', 53)
            ->assertJsonCount(3, 'items')->assertJsonPath('items.0.full_name', 'Vecino 050');
        $this->getJson('/api/v1/neighbors?q=doc-52')->assertJsonPath('total', 1);
        $this->getJson('/api/v1/neighbors?q='.urlencode('%_!'))->assertJsonPath('total', 1);
        $this->getJson('/api/v1/neighbors?q='.urlencode("' OR 1=1 --"))->assertJsonPath('total', 0);
        $this->getJson('/api/v1/neighbors?page=100')->assertJsonPath('total', 54)->assertJsonCount(0, 'items');
    }

    public function test_pending_count_is_per_line_across_loans_and_detail_never_writes_history(): void
    {
        $this->authenticate();
        $item = $this->loanItem();
        $item['due_at'] = '2020-01-01T12:00:00Z';
        DB::table('loan_item')->insert($item);
        $loan = DB::table('loan')->where('id', $item['loan_id'])->first();
        $secondArticle = $this->article(['reference' => 'SECOND']);
        $thirdArticle = $this->article(['reference' => 'THIRD']);
        DB::table('article')->insert([$secondArticle, $thirdArticle]);
        DB::table('loan_item')->insert(array_replace($item, ['id' => (string) Str::uuid(), 'article_id' => $secondArticle['id'], 'due_at' => '2099-01-01T12:00:00Z']));
        DB::table('loan_item')->insert(array_replace($item, ['id' => (string) Str::uuid(), 'article_id' => $thirdArticle['id'], 'returned_at' => '2020-01-02T12:00:00Z']));
        $secondLoan = (string) Str::uuid();
        DB::table('loan')->insert(['id' => $secondLoan, 'neighbor_id' => $loan->neighbor_id,
            'loaned_by_user_id' => $loan->loaned_by_user_id, 'loaned_at' => '2026-11-15T12:00:00Z']);
        DB::table('loan_item')->insert(array_replace($item, ['id' => (string) Str::uuid(), 'loan_id' => $secondLoan, 'due_at' => '2099-01-01T12:00:00Z']));
        $otherId = (string) Str::uuid();
        DB::table('neighbor')->insert(['id' => $otherId, 'full_name' => 'Otro vecino', 'document_number' => 'OTHER']);
        $otherLoan = (string) Str::uuid();
        DB::table('loan')->insert(['id' => $otherLoan, 'neighbor_id' => $otherId, 'loaned_by_user_id' => $loan->loaned_by_user_id, 'loaned_at' => '2026-11-15T12:00:00Z']);
        DB::table('loan_item')->insert(array_replace($item, ['id' => (string) Str::uuid(), 'loan_id' => $otherLoan]));
        $snapshots = [];
        foreach (['neighbor', 'loan', 'loan_item', 'article'] as $table) {
            $snapshots[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        $statements = [];
        DB::listen(function (QueryExecuted $query) use (&$statements): void {
            $statements[] = strtolower(ltrim($query->sql));
        });
        $this->getJson('/api/v1/neighbors/'.$loan->neighbor_id)->assertOk()->assertJsonPath('active_loans', 3);
        $neighborQueries = array_filter($statements, fn (string $sql) => str_contains($sql, 'from "neighbor"'));
        $this->assertCount(1, $neighborQueries);
        foreach ($statements as $sql) {
            $this->assertStringStartsWith('select', $sql);
        }
        $this->getJson('/api/v1/neighbors/'.$otherId)->assertJsonPath('active_loans', 1);
        foreach ($snapshots as $table => $snapshot) {
            $this->assertSame($snapshot, DB::table($table)->orderBy('id')->get()->toJson(), $table);
        }
    }

    public function test_neighbors_with_only_returned_items_have_zero_pending(): void
    {
        $this->authenticate();
        $item = $this->loanItem();
        $item['returned_at'] = '2026-11-15T12:00:00Z';
        DB::table('loan_item')->insert($item);
        $neighborId = DB::table('loan')->where('id', $item['loan_id'])->value('neighbor_id');
        $this->getJson('/api/v1/neighbors/'.$neighborId)->assertOk()->assertJsonPath('active_loans', 0);
    }

    public function test_invalid_inputs_and_nonexistent_neighbors_are_uniform_errors(): void
    {
        $this->authenticate();
        $this->postJson('/api/v1/neighbors', ['full_name' => 'Vecino', 'document_number' => str_repeat('a', 31)])->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        $this->getJson('/api/v1/neighbors?size=51')->assertUnprocessable();
        $this->getJson('/api/v1/neighbors/'.Str::uuid())->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
        $this->getJson('/api/v1/neighbors/not-a-uuid')->assertNotFound();
        $this->assertSame(0, DB::table('neighbor')->count());
    }
}
