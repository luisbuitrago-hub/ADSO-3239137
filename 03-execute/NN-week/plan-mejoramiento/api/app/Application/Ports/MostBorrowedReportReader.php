<?php

namespace App\Application\Ports;

use App\Domain\ValueObjects\DateRange;

interface MostBorrowedReportReader
{
    public function rows(DateRange $range): array;
}
