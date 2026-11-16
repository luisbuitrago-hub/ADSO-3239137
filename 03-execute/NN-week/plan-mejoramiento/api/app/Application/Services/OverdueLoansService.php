<?php

namespace App\Application\Services;

use App\Application\Ports\Clock;
use App\Application\Ports\LoanRepository;

final readonly class OverdueLoansService
{
    public function __construct(private LoanRepository $loans, private Clock $clock) {}

    public function list(): array
    {
        return ['items' => $this->loans->overdue($this->clock->now())];
    }
}
