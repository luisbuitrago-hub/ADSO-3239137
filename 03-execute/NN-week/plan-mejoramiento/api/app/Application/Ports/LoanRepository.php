<?php

namespace App\Application\Ports;

use App\Domain\Entities\Loan;
use App\Domain\Entities\LoanItem;
use App\Domain\ValueObjects\DateRange;
use DateTimeImmutable;

interface LoanRepository
{
    /** @return array{count: int, overdue: bool} */
    public function pendingState(string $neighborId, DateTimeImmutable $now): array;

    public function create(Loan $loan): void;

    public function find(string $id): ?Loan;

    public function findItem(string $loanId, string $itemId, bool $forUpdate = false): ?LoanItem;

    public function saveReturn(LoanItem $item): void;

    /** @return array{items: list<Loan>, total: int} */
    public function search(DateRange $dates, ?string $status, ?string $neighborId, int $page, int $size, DateTimeImmutable $now): array;

    public function overdue(DateTimeImmutable $now): array;
}
