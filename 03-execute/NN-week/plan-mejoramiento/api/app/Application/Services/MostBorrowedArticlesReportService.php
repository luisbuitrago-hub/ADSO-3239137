<?php

namespace App\Application\Services;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\MostBorrowedReportReader;
use App\Domain\ValueObjects\DateRange;

final readonly class MostBorrowedArticlesReportService
{
    public function __construct(private MostBorrowedReportReader $reader) {}

    public function report(string $actorRole, string $from, string $to): array
    {
        if ($actorRole !== 'admin') {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }

        return ['from' => $from, 'to' => $to, 'rows' => $this->reader->rows(new DateRange($from, $to))];
    }
}
