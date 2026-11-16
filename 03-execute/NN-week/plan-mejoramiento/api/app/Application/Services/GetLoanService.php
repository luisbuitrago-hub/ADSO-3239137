<?php

namespace App\Application\Services;

use App\Application\Ports\Clock;
use App\Application\Ports\LoanRepository;
use App\Domain\Exceptions\LoanViolation;

final readonly class GetLoanService
{
    public function __construct(private LoanRepository $loans, private Clock $clock) {}

    public function get(string $id): array
    {
        $loan = $this->loans->find($id) ?? throw new LoanViolation('NOT_FOUND', 'El préstamo solicitado no existe.');

        return $loan->publicData($this->clock->now());
    }
}
