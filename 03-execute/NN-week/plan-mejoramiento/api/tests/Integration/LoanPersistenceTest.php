<?php

namespace Tests\Integration;

use Tests\Support\LoanScenarios;
use Tests\Support\PostgresTestCase;

class LoanPersistenceTest extends PostgresTestCase
{
    use LoanScenarios;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeLoans();
    }
}
