<?php

namespace Tests\Integration;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Support\ConcurrentPostgresTestCase;
use Tests\Support\LoanFixtures;

class LoanConcurrencyTest extends ConcurrentPostgresTestCase
{
    // Solo se reutilizan fixtures; las pruebas HTTP comunes se ejecutan en LoanPersistenceTest.
    use LoanFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeLoans();
    }

    private function requestFor(array $articles, ?array $neighbor = null): array
    {
        $operator = User::factory()->create(['role' => 'operator']);

        return ['actor_id' => $operator->id, 'path' => '/api/v1/loans', 'payload' => $this->loanPayload($articles, $neighbor)];
    }

    public function test_last_unit_has_one_success_and_one_conflict_with_two_blocked_connections(): void
    {
        $article = $this->makeArticle(['total_units' => 1, 'available_units' => 1]);
        $result = $this->race([$this->requestFor([$article]), $this->requestFor([$article], $this->makeBorrower())], 'article', $article['id']);
        $statuses = array_column($result['responses'], 'status');
        sort($statuses);
        $this->assertSame([201, 409], $statuses);
        $rejected = array_values(array_filter($result['responses'], fn ($response) => $response['status'] === 409))[0];
        $this->assertSame('ARTICLE_NOT_AVAILABLE', $rejected['body']['code']);
        $this->assertSame(0, DB::table('article')->value('available_units'));
        $this->assertSame(1, DB::table('loan_item')->whereNull('returned_at')->count());
        fwrite(STDOUT, "\nADR-002 última unidad: HTTP 201/409; conexiones bloqueadas=2; stock=0; pendientes=1.\n");
    }

    public function test_same_neighbor_cannot_exceed_three_pending_items_concurrently(): void
    {
        $first = $this->makeArticle();
        $second = $this->makeArticle();
        $third = $this->makeArticle();
        $fourth = $this->makeArticle();
        $this->lend([$first, $second]);
        $result = $this->race([$this->requestFor([$third]), $this->requestFor([$fourth])], 'neighbor', $this->borrower['id']);
        $statuses = array_column($result['responses'], 'status');
        sort($statuses);
        $this->assertSame([201, 422], $statuses);
        $rejected = array_values(array_filter($result['responses'], fn ($response) => $response['status'] === 422))[0];
        $this->assertSame('NEIGHBOR_LIMIT_EXCEEDED', $rejected['body']['code']);
        $this->assertSame(3, DB::table('loan_item')->whereNull('returned_at')->count());
        $this->assertSame(2, DB::table('loan')->count());
        $this->assertSame(3, (int) DB::table('article')->whereIn('id', [$third['id'], $fourth['id']])->sum('available_units'));
        fwrite(STDOUT, "\nADR-002 mismo vecino: HTTP 201/422; conexiones bloqueadas=2; pendientes=3.\n");
    }

    public function test_concurrent_returns_restore_inventory_exactly_once(): void
    {
        $article = $this->makeArticle(['total_units' => 1, 'available_units' => 1]);
        $loan = $this->lend([$article]);
        $request = ['actor_id' => $this->loanActor->id, 'path' => $this->returnPath($loan), 'payload' => []];
        $other = array_replace($request, ['actor_id' => User::factory()->create(['role' => 'operator'])->id]);
        $result = $this->race([$request, $other], 'neighbor', $this->borrower['id']);
        $statuses = array_column($result['responses'], 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $rejected = array_values(array_filter($result['responses'], fn ($response) => $response['status'] === 409))[0];
        $this->assertSame('ITEM_ALREADY_RETURNED', $rejected['body']['code']);
        $this->assertSame(1, DB::table('article')->value('available_units'));
        $this->assertSame(1, DB::table('loan_item')->whereNotNull('returned_at')->count());
        fwrite(STDOUT, "\nADR-002 devolución duplicada: HTTP 200/409; conexiones bloqueadas=2; stock=1; devoluciones=1.\n");
    }

    public function test_failed_multi_article_loan_rolls_back_the_complete_transaction(): void
    {
        $available = $this->makeArticle(['total_units' => 1, 'available_units' => 1]);
        $unavailable = $this->makeArticle(['available_units' => 0]);
        $this->postJson('/api/v1/loans', $this->loanPayload([$available, $unavailable]))->assertConflict()->assertJsonPath('code', 'ARTICLE_NOT_AVAILABLE');
        $this->assertSame(1, DB::table('article')->where('id', $available['id'])->value('available_units'));
        $this->assertSame(0, DB::table('loan')->count());
        $this->assertSame(0, DB::table('loan_item')->count());
        fwrite(STDOUT, "\nADR-002 atomicidad: HTTP 409; stock inicial conservado; préstamos=0; líneas=0.\n");
    }

    public function test_lending_racing_with_deactivation_preserves_active_inventory_and_pending_lines(): void
    {
        $article = $this->makeArticle(['total_units' => 1, 'available_units' => 1]);
        $admin = User::factory()->create(['role' => 'admin']);
        $deactivate = ['actor_id' => $admin->id, 'method' => 'DELETE', 'path' => '/api/v1/articles/'.$article['id'], 'payload' => []];
        $result = $this->race([$this->requestFor([$article]), $deactivate], 'article', $article['id']);
        [$lend, $delete] = $result['responses'];
        $row = DB::table('article')->where('id', $article['id'])->first();
        if ($lend['status'] === 201) {
            $this->assertSame(409, $delete['status']);
            $this->assertSame('ARTICLE_HAS_OPEN_LOANS', $delete['body']['code']);
            $this->assertNull($row->deleted_at);
            $this->assertSame(0, $row->available_units);
            $this->assertSame(1, DB::table('loan_item')->count());
        } else {
            $this->assertSame(404, $lend['status']);
            $this->assertSame(204, $delete['status']);
            $this->assertNotNull($row->deleted_at);
            $this->assertSame(1, $row->available_units);
            $this->assertSame(0, DB::table('loan_item')->count());
        }
    }

    public function test_lending_racing_with_total_reduction_never_loses_inventory_updates(): void
    {
        $article = $this->makeArticle();
        $this->lend([$article]);
        $admin = User::factory()->create(['role' => 'admin']);
        $update = ['actor_id' => $admin->id, 'method' => 'PUT', 'path' => '/api/v1/articles/'.$article['id'], 'payload' => ['total_units' => 1]];
        $result = $this->race([$this->requestFor([$article], $this->makeBorrower()), $update], 'article', $article['id']);
        [$lend, $adjust] = $result['responses'];
        $row = DB::table('article')->where('id', $article['id'])->first();
        $pending = DB::table('loan_item')->where('article_id', $article['id'])->whereNull('returned_at')->count();
        $this->assertSame(0, $row->available_units);
        $this->assertSame($row->total_units, $pending);
        if ($lend['status'] === 201) {
            $this->assertSame(422, $adjust['status']);
            $this->assertSame(2, $row->total_units);
        } else {
            $this->assertSame(409, $lend['status']);
            $this->assertSame(200, $adjust['status']);
            $this->assertSame(1, $row->total_units);
        }
    }
}
