<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;

trait ReportScenarios
{
    use LoanFixtures;

    protected function initializeReports(): void
    {
        $this->initializeLoans();
        $this->loanActor->update(['role' => 'admin']);
    }

    protected function reportedLoan(array $article, string $at): array
    {
        $this->loanClock->set($at);
        $loan = $this->lend([$article], $this->makeBorrower());
        $this->postJson($this->returnPath($loan))->assertOk();

        return $loan;
    }

    public function test_report_uses_historical_groups_including_inactive_articles_and_has_no_personal_data(): void
    {
        $a = $this->makeArticle(['name' => 'Olla historica']);
        $b = $this->makeArticle(['name' => 'Alfa']);
        $c = $this->makeArticle(['name' => 'Zeta']);
        $this->reportedLoan($a, '2026-11-01T00:00:00Z');
        $this->reportedLoan($a, '2026-11-30T23:59:59Z');
        $this->putJson('/api/v1/articles/'.$a['id'], ['category_id' => '22222222-2222-4222-8222-222222222222'])->assertOk();
        $this->reportedLoan($a, '2026-11-15T12:00:00Z');
        $this->putJson('/api/v1/articles/'.$a['id'], ['name' => 'Nombre nuevo'])->assertOk();
        $this->reportedLoan($a, '2026-11-15T12:00:00Z');
        for ($i = 0; $i < 2; $i++) {
            $this->reportedLoan($b, '2026-11-15T12:00:00Z');
        }
        for ($i = 0; $i < 3; $i++) {
            $this->reportedLoan($c, '2026-11-15T12:00:00Z');
        }
        $this->deleteJson('/api/v1/articles/'.$a['id'])->assertNoContent();
        $snapshots = DB::table('loan_item')->orderBy('id')->get()->toJson();
        $inventory = DB::table('article')->orderBy('id')->get()->toJson();
        $this->getJson('/api/v1/reports/most-borrowed?from=2026-11-01&to=2026-11-30')->assertOk()->assertExactJson([
            'from' => '2026-11-01', 'to' => '2026-11-30', 'rows' => [
                ['article_id' => $c['id'], 'article_name' => 'Zeta', 'category_name' => 'ollas', 'times_borrowed' => 3],
                ['article_id' => $b['id'], 'article_name' => 'Alfa', 'category_name' => 'ollas', 'times_borrowed' => 2],
                ['article_id' => $a['id'], 'article_name' => 'Olla historica', 'category_name' => 'ollas', 'times_borrowed' => 2],
                ['article_id' => $a['id'], 'article_name' => 'Nombre nuevo', 'category_name' => 'vajilla', 'times_borrowed' => 1],
                ['article_id' => $a['id'], 'article_name' => 'Olla historica', 'category_name' => 'vajilla', 'times_borrowed' => 1],
            ],
        ]);
        $this->assertSame($snapshots, DB::table('loan_item')->orderBy('id')->get()->toJson());
        $this->assertSame($inventory, DB::table('article')->orderBy('id')->get()->toJson());
    }

    public function test_date_boundaries_are_inclusive_and_empty_periods_return_empty_rows(): void
    {
        $a = $this->makeArticle();
        foreach (['2026-10-31T23:59:59Z', '2026-11-01T00:00:00Z', '2026-11-30T23:59:59Z', '2026-12-01T00:00:00Z'] as $at) {
            $this->reportedLoan($a, $at);
        }
        $this->getJson('/api/v1/reports/most-borrowed?from=2026-11-01&to=2026-11-30')->assertOk()->assertJsonCount(1, 'rows')->assertJsonPath('rows.0.times_borrowed', 2);
        $this->getJson('/api/v1/reports/most-borrowed?from=2026-11-30&to=2026-11-30')->assertJsonPath('rows.0.times_borrowed', 1);
        $this->getJson('/api/v1/reports/most-borrowed?from=2027-01-01&to=2027-01-31')->assertOk()->assertExactJson(['from' => '2027-01-01', 'to' => '2027-01-31', 'rows' => []]);
    }

    public function test_missing_invalid_and_reversed_dates_produce_uniform_errors(): void
    {
        foreach (['', '?from=2026-11-01', '?to=2026-11-30'] as $query) {
            $this->getJson('/api/v1/reports/most-borrowed'.$query)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
        foreach (['from=2026-12-01&to=2026-11-01', 'from=invalid&to=2026-11-01', 'from=2026-02-30&to=2026-11-01',
            'from='.urlencode("2026-01\0-01").'&to=2026-11-01'] as $query) {
            $this->getJson('/api/v1/reports/most-borrowed?'.$query)->assertUnprocessable()->assertJsonPath('code', 'INVALID_DATE_RANGE');
        }
    }

    public function test_report_is_admin_only_and_does_not_validate_or_disclose_data_to_operators(): void
    {
        $this->loanActor->update(['role' => 'operator']);
        $this->getJson('/api/v1/reports/most-borrowed')->assertForbidden()->assertExactJson([
            'code' => 'FORBIDDEN_ROLE', 'message' => 'No tienes permisos para realizar esta operación.', 'details' => [],
        ]);
        $this->flushHeaders();
        $this->getJson('/api/v1/reports/most-borrowed?from=2026-11-01&to=2026-11-30')->assertUnauthorized();
    }
}
