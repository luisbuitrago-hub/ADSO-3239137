<?php

namespace Tests\Unit;

use App\Domain\Exceptions\LoanViolation;
use App\Domain\ValueObjects\DateRange;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class DateRangeTest extends TestCase
{
    public function test_dates_are_inclusive_utc_and_leap_days_are_validated(): void
    {
        $range = new DateRange('2024-02-29', '2024-02-29');
        $this->assertSame('2024-02-29T00:00:00+00:00', $range->start->format(DATE_ATOM));
        $this->assertSame('2024-03-01T00:00:00+00:00', $range->endExclusive->format(DATE_ATOM));
        $this->assertNull((new DateRange)->start);
        $this->assertNull((new DateRange)->endExclusive);
    }

    public static function invalidRanges(): array
    {
        return [['2026-02-29', null], ['2026-2-01', null], ['2026-11-16', '2026-11-15']];
    }

    #[DataProvider('invalidRanges')]
    public function test_invalid_dates_and_reversed_ranges_fail(string $from, ?string $to): void
    {
        $this->expectException(LoanViolation::class);
        new DateRange($from, $to);
    }
}
