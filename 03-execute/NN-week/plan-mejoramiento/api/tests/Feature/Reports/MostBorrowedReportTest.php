<?php

namespace Tests\Feature\Reports;

use Tests\Support\LoanTestCase;
use Tests\Support\ReportScenarios;

class MostBorrowedReportTest extends LoanTestCase
{
    use ReportScenarios;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeReports();
    }
}
