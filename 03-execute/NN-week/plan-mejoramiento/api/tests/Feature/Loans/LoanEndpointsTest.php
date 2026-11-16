<?php

namespace Tests\Feature\Loans;

use Tests\Support\LoanScenarios;
use Tests\Support\LoanTestCase;

class LoanEndpointsTest extends LoanTestCase
{
    use LoanScenarios;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeLoans();
    }

    public function test_insufficient_roles_are_rejected_before_loan_validation_and_lookup(): void
    {
        // SQLite permite esta fixture de defensa; PostgreSQL restringe los roles por CHECK.
        $this->loanActor->update(['role' => 'other']);
        $id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        $this->getJson('/api/v1/loans')->assertForbidden();
        $this->getJson('/api/v1/loans/overdue')->assertForbidden();
        $this->getJson('/api/v1/loans/'.$id)->assertForbidden();
        $this->postJson('/api/v1/loans', [])->assertForbidden();
        $this->postJson('/api/v1/loans/'.$id.'/items/'.$id.'/return')->assertForbidden();
    }
}
