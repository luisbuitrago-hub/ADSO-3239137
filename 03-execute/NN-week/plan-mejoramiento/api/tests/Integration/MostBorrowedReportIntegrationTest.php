<?php

namespace Tests\Integration;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\PostgresTestCase;
use Tests\Support\ReportScenarios;

class MostBorrowedReportIntegrationTest extends PostgresTestCase
{
    use ReportScenarios;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeReports();
    }

    public function test_postgresql_interprets_offset_timestamps_using_utc_date_boundaries(): void
    {
        $item = $this->loanItem();
        DB::table('loan_item')->insert($item);
        DB::table('loan')->where('id', $item['loan_id'])->update(['loaned_at' => '2026-10-31T19:00:00-05:00']);
        $loan = (array) DB::table('loan')->where('id', $item['loan_id'])->first();
        $loan['id'] = (string) Str::uuid();
        $loan['loaned_at'] = '2026-11-30T19:00:00-05:00';
        DB::table('loan')->insert($loan);
        DB::table('loan_item')->insert(array_replace($item, ['id' => (string) Str::uuid(), 'loan_id' => $loan['id']]));
        $this->getJson('/api/v1/reports/most-borrowed?from=2026-11-01&to=2026-11-30')->assertOk()->assertJsonPath('rows.0.times_borrowed', 1);
    }
}
