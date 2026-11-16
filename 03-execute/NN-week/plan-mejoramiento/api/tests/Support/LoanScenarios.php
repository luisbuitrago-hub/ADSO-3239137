<?php

namespace Tests\Support;

use App\Models\LoanItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;

trait LoanScenarios
{
    use LoanFixtures;

    public static function lendingRoles(): array
    {
        return [['admin'], ['operator']];
    }

    #[DataProvider('lendingRoles')]
    public function test_successful_lending_records_actor_inventory_deadline_and_exact_contract(string $role): void
    {
        $this->loanActor->update(['role' => $role]);
        $a = $this->makeArticle();
        $loan = $this->lend([$a]);
        $this->assertSame(['id', 'neighbor_id', 'loaned_at', 'status', 'items'], array_keys($loan));
        $this->assertSame($this->borrower['id'], $loan['neighbor_id']);
        $this->assertSame('2026-11-15T12:00:00Z', $loan['loaned_at']);
        $this->assertSame('open', $loan['status']);
        $this->assertSame(['id' => $loan['items'][0]['id'], 'article_id' => $a['id'], 'article_name' => $a['name'], 'article_reference' => $a['reference'],
            'category_name' => 'ollas', 'due_at' => '2026-11-18T12:00:00Z', 'returned_at' => null], $loan['items'][0]);
        $this->assertSame($this->loanActor->id, DB::table('loan')->value('loaned_by_user_id'));
        $this->assertSame(1, DB::table('article')->where('id', $a['id'])->value('available_units'));
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertOk()->assertExactJson($loan);
        $this->getJson('/api/v1/neighbors/'.$this->borrower['id'])->assertJsonPath('active_loans', 1);
    }

    public function test_insufficient_stock_rolls_back_earlier_inventory_changes(): void
    {
        $a = $this->makeArticle(['total_units' => 1, 'available_units' => 1]);
        $b = $this->makeArticle(['available_units' => 0]);
        $this->postJson('/api/v1/loans', $this->loanPayload([$a, $b]))->assertConflict()->assertJsonPath('code', 'ARTICLE_NOT_AVAILABLE');
        $this->assertSame(1, DB::table('article')->where('id', $a['id'])->value('available_units'));
        $this->assertSame(0, DB::table('loan')->count());
        $this->assertSame(0, DB::table('loan_item')->count());
    }

    public function test_failure_after_inserting_loan_and_first_line_rolls_back_everything(): void
    {
        $a = $this->makeArticle();
        $b = $this->makeArticle();
        $insertions = 0;
        LoanItem::creating(function () use (&$insertions): void {
            if (++$insertions === 2) {
                throw new \RuntimeException('Fallo de persistencia simulado.');
            }
        });
        Log::spy();
        try {
            $this->postJson('/api/v1/loans', $this->loanPayload([$a, $b]))->assertStatus(500)->assertJsonPath('code', 'INTERNAL_ERROR');
        } finally {
            LoanItem::flushEventListeners();
        }
        $this->assertSame(2, $insertions);
        $this->assertSame(0, DB::table('loan')->count());
        $this->assertSame(0, DB::table('loan_item')->count());
        $this->assertSame(4, (int) DB::table('article')->sum('available_units'));
    }

    public function test_neighbor_limit_applies_across_loans_and_rejects_without_partial_changes(): void
    {
        $a = $this->makeArticle();
        $b = $this->makeArticle();
        $c = $this->makeArticle();
        $d = $this->makeArticle();
        $this->lend([$a, $b]);
        $this->postJson('/api/v1/loans', $this->loanPayload([$c, $d]))->assertUnprocessable()->assertJsonPath('code', 'NEIGHBOR_LIMIT_EXCEEDED');
        $this->lend([$c]);
        $this->postJson('/api/v1/loans', $this->loanPayload([$d]))->assertUnprocessable()->assertJsonPath('code', 'NEIGHBOR_LIMIT_EXCEEDED');
        $this->assertSame(3, DB::table('loan_item')->whereNull('returned_at')->count());
        $this->assertSame(2, DB::table('article')->where('id', $d['id'])->value('available_units'));
    }

    public function test_due_boundary_and_overdue_neighbor_blocking_are_consistent(): void
    {
        $a = $this->makeArticle();
        $b = $this->makeArticle();
        $c = $this->makeArticle();
        $loan = $this->lend([$a]);
        $this->loanClock->set('2026-11-18T12:00:00Z');
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertJsonPath('status', 'open');
        $this->getJson('/api/v1/loans/overdue')->assertExactJson(['items' => []]);
        $this->lend([$b]);
        $this->loanClock->set('2026-11-18T12:00:01Z');
        $this->postJson('/api/v1/loans', $this->loanPayload([$c]))->assertConflict()->assertJsonPath('code', 'NEIGHBOR_HAS_OVERDUE');
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertJsonPath('status', 'overdue');
        $this->postJson($this->returnPath($loan))->assertOk();
        $this->lend([$c]);
    }

    public function test_partial_returns_restore_once_and_close_only_after_all_lines_returned(): void
    {
        $a = $this->makeArticle();
        $b = $this->makeArticle();
        $loan = $this->lend([$a, $b]);
        $this->loanClock->set('2026-11-16T13:30:00Z');
        $returned = $this->postJson($this->returnPath($loan))->assertOk()->json();
        $this->assertSame(array_replace($loan['items'][0], ['returned_at' => '2026-11-16T13:30:00Z']), $returned);
        $this->postJson($this->returnPath($loan))->assertConflict()->assertJsonPath('code', 'ITEM_ALREADY_RETURNED');
        $this->assertSame(2, DB::table('article')->where('id', $a['id'])->value('available_units'));
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertJsonPath('status', 'open');
        $this->postJson($this->returnPath($loan, 1))->assertOk();
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertJsonPath('status', 'closed');
        $this->getJson('/api/v1/neighbors/'.$this->borrower['id'])->assertJsonPath('active_loans', 0);
    }

    public function test_wrong_loan_membership_missing_ids_and_inactive_articles_are_protected(): void
    {
        $a = $this->makeArticle();
        $b = $this->makeArticle();
        $one = $this->lend([$a]);
        $two = $this->lend([$b]);
        $path = '/api/v1/loans/'.$one['id'].'/items/'.$two['items'][0]['id'].'/return';
        $this->postJson($path)->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
        $this->getJson('/api/v1/loans/'.Str::uuid())->assertNotFound();
        $this->getJson('/api/v1/loans/invalid')->assertNotFound();
        $inactive = $this->makeArticle(['deleted_at' => '2026-11-15 00:00:00']);
        $this->postJson('/api/v1/loans', $this->loanPayload([$inactive]))->assertNotFound();
        $this->postJson('/api/v1/loans', $this->loanPayload([$a], ['id' => (string) Str::uuid()]))->assertNotFound();
        $this->assertSame(2, DB::table('loan_item')->whereNull('returned_at')->count());
        $this->assertSame(1, DB::table('article')->where('id', $b['id'])->value('available_units'));
    }

    public function test_invalid_and_duplicate_lines_or_client_timestamps_never_create_loans(): void
    {
        $a = $this->makeArticle();
        $this->postJson('/api/v1/loans', $this->loanPayload([$a, ['id' => strtoupper($a['id'])]]))->assertUnprocessable()->assertJsonPath('code', 'DUPLICATE_ARTICLE_IN_LOAN');
        foreach ([[], [['article_id' => $a['id']], ['article_id' => $a['id']], ['article_id' => $a['id']], ['article_id' => $a['id']]], [['article_id' => 'invalid']], [['article_id' => $a['id'], 'returned_at' => '2020-01-01']]] as $items) {
            $this->postJson('/api/v1/loans', ['neighbor_id' => $this->borrower['id'], 'items' => $items])->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
        foreach (['id', 'loaned_at', 'loaned_by_user_id', 'status'] as $field) {
            $this->postJson('/api/v1/loans', $this->loanPayload([$a]) + [$field => 'untrusted'])->assertUnprocessable();
        }
        $this->assertSame(0, DB::table('loan')->count());
    }

    public function test_catalog_changes_returns_and_deactivation_preserve_snapshots(): void
    {
        $this->loanActor->update(['role' => 'admin']);
        $a = $this->makeArticle();
        $loan = $this->lend([$a]);
        $original = $loan['items'][0];
        $this->putJson('/api/v1/articles/'.$a['id'], ['name' => 'Nombre nuevo', 'category_id' => '22222222-2222-4222-8222-222222222222'])->assertOk();
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertJsonPath('items.0.article_name', $original['article_name'])->assertJsonPath('items.0.category_name', 'ollas');
        $this->deleteJson('/api/v1/articles/'.$a['id'])->assertConflict();
        $this->postJson($this->returnPath($loan))->assertOk()->assertJsonPath('article_name', $original['article_name']);
        $this->deleteJson('/api/v1/articles/'.$a['id'])->assertNoContent();
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertOk()->assertJsonPath('items.0.article_reference', $original['article_reference'])->assertJsonPath('items.0.category_name', 'ollas');
    }

    public function test_return_cannot_exceed_total_inventory(): void
    {
        $a = $this->makeArticle();
        $loan = $this->lend([$a]);
        DB::table('article')->where('id', $a['id'])->update(['available_units' => $a['total_units']]);
        $this->postJson($this->returnPath($loan))->assertUnprocessable();
        $this->assertNull(DB::table('loan_item')->value('returned_at'));
        $this->assertSame(2, DB::table('article')->value('available_units'));
    }

    public function test_uuid_letter_case_does_not_change_route_or_filter_identity(): void
    {
        $article = $this->makeArticle();
        $loan = $this->lend([$article]);
        $this->getJson('/api/v1/loans/'.strtoupper($loan['id']))->assertOk();
        $this->getJson('/api/v1/loans?neighbor_id='.strtoupper($loan['neighbor_id']))->assertJsonPath('total', 1);
        $path = '/api/v1/loans/'.strtoupper($loan['id']).'/items/'.strtoupper($loan['items'][0]['id']).'/return';
        $this->postJson($path)->assertOk();
    }

    public function test_return_of_a_legacy_inactive_article_preserves_its_deactivation(): void
    {
        $article = $this->makeArticle();
        $loan = $this->lend([$article]);
        // Fixture aislada de un dato histórico: la API de catálogo impide esta baja con pendientes.
        DB::table('article')->where('id', $article['id'])->update(['deleted_at' => '2026-11-15 12:00:00']);
        $this->postJson($this->returnPath($loan))->assertOk();
        $this->assertSame(2, DB::table('article')->where('id', $article['id'])->value('available_units'));
        $this->assertNotNull(DB::table('article')->where('id', $article['id'])->value('deleted_at'));
        $this->getJson('/api/v1/articles/'.$article['id'])->assertNotFound();
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertJsonPath('status', 'closed');
    }

    public function test_loan_filters_pagination_inclusive_dates_and_calculated_states(): void
    {
        $a = $this->makeArticle(['total_units' => 5, 'available_units' => 5]);
        $this->loanClock->set('2026-11-01T12:00:00Z');
        $closed = $this->lend([$a]);
        $this->postJson($this->returnPath($closed))->assertOk();
        $this->loanClock->set('2026-11-10T23:59:59Z');
        $overdue = $this->lend([$a], $this->makeBorrower());
        $this->loanClock->set('2026-11-15T12:00:00Z');
        $open = $this->lend([$a], $this->makeBorrower());
        $this->getJson('/api/v1/loans?size=1&page=2')->assertJsonPath('total', 3)->assertJsonCount(1, 'items')->assertJsonPath('items.0.id', $overdue['id']);
        foreach (['closed' => $closed, 'overdue' => $overdue, 'open' => $open] as $status => $loan) {
            $this->getJson('/api/v1/loans?status='.$status)->assertOk()->assertJsonPath('total', 1)->assertJsonPath('items.0.status', $status)->assertJsonPath('items.0.id', $loan['id']);
        }
        $this->getJson('/api/v1/loans?from=2026-11-10&to=2026-11-10')->assertJsonPath('total', 1)->assertJsonPath('items.0.id', $overdue['id']);
        $this->getJson('/api/v1/loans?neighbor_id='.$open['neighbor_id'])->assertJsonPath('total', 1)->assertJsonPath('items.0.id', $open['id']);
        $this->getJson('/api/v1/loans?page=100')->assertJsonCount(0, 'items')->assertJsonPath('total', 3);
        $this->getJson('/api/v1/loans?from=2026-12-01&to=2026-11-01')->assertUnprocessable()->assertJsonPath('code', 'INVALID_DATE_RANGE');
        foreach (['status=invalid', 'size=51', 'page=0', 'from=2026-02-30', 'neighbor_id=invalid'] as $query) {
            $this->getJson('/api/v1/loans?'.$query)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
    }

    public function test_overdue_route_orders_historical_lines_and_excludes_returns_and_boundary(): void
    {
        $a = $this->makeArticle(['total_units' => 5, 'available_units' => 5]);
        $this->loanClock->set('2026-11-01T12:00:00Z');
        $oldest = $this->lend([$a]);
        $this->loanClock->set('2026-11-10T12:00:00Z');
        $recent = $this->lend([$a], $this->makeBorrower());
        $this->loanClock->set('2026-11-12T12:00:00Z');
        $this->lend([$a], $this->makeBorrower());
        $closed = $this->lend([$a], $this->makeBorrower());
        $this->postJson($this->returnPath($closed))->assertOk();
        $this->loanClock->set('2026-11-15T12:00:00Z');
        $response = $this->getJson('/api/v1/loans/overdue')->assertOk()->assertJsonCount(2, 'items');
        $response->assertJsonPath('items.0.loan_id', $oldest['id'])->assertJsonPath('items.0.days_late', 11)
            ->assertJsonPath('items.1.loan_id', $recent['id'])->assertJsonPath('items.1.days_late', 2);
        $this->assertSame(['loan_id', 'item_id', 'article_name', 'neighbor_name', 'due_at', 'days_late'], array_keys($response->json('items.0')));
    }

    public function test_authentication_is_required_for_all_five_endpoints_and_loans_are_immutable(): void
    {
        $a = $this->makeArticle();
        $loan = $this->lend([$a]);
        $this->putJson('/api/v1/loans/'.$loan['id'], [])->assertStatus(405);
        $this->deleteJson('/api/v1/loans/'.$loan['id'])->assertStatus(405);
        $this->flushHeaders();
        $this->getJson('/api/v1/loans')->assertUnauthorized();
        $this->getJson('/api/v1/loans/'.$loan['id'])->assertUnauthorized();
        $this->getJson('/api/v1/loans/overdue')->assertUnauthorized();
        $this->postJson('/api/v1/loans', [])->assertUnauthorized();
        $this->postJson($this->returnPath($loan))->assertUnauthorized();
    }
}
