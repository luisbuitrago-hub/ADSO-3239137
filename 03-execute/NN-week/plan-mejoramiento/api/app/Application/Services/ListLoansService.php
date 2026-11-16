<?php

namespace App\Application\Services;

use App\Application\Ports\Clock;
use App\Application\Ports\LoanRepository;
use App\Domain\Entities\Loan;
use App\Domain\Exceptions\LoanViolation;
use App\Domain\ValueObjects\DateRange;

final readonly class ListLoansService
{
    public function __construct(private LoanRepository $loans, private Clock $clock) {}

    public function list(array $filters): array
    {
        $page = (int) ($filters['page'] ?? 1);
        $size = (int) ($filters['size'] ?? 20);
        $status = $filters['status'] ?? null;
        if ($page < 1 || $page > 2147483647 || $size < 1 || $size > 50 || ($status !== null && ! in_array($status, ['open', 'overdue', 'closed'], true))) {
            throw new LoanViolation('VALIDATION_ERROR', 'Los filtros o la paginación no son válidos.');
        }
        $now = $this->clock->now();
        $result = $this->loans->search(new DateRange($filters['from'] ?? null, $filters['to'] ?? null), $status, $filters['neighbor_id'] ?? null, $page, $size, $now);

        return ['items' => array_map(fn (Loan $loan) => $loan->publicData($now), $result['items']), 'page' => $page, 'size' => $size, 'total' => $result['total']];
    }
}
