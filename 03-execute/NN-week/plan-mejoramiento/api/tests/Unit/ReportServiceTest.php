<?php

namespace Tests\Unit;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\MostBorrowedReportReader;
use App\Application\Services\MostBorrowedArticlesReportService;
use App\Domain\ValueObjects\DateRange;
use PHPUnit\Framework\TestCase;

class ReportServiceTest extends TestCase
{
    public function test_report_uses_inclusive_date_range_and_read_port_without_framework(): void
    {
        $reader = $this->createMock(MostBorrowedReportReader::class);
        $reader->expects($this->once())->method('rows')->with($this->callback(fn (DateRange $dates) => $dates->start->format(DATE_ATOM) === '2026-11-01T00:00:00+00:00' && $dates->endExclusive->format(DATE_ATOM) === '2026-12-01T00:00:00+00:00'))->willReturn([]);
        $this->assertSame(['from' => '2026-11-01', 'to' => '2026-11-30', 'rows' => []], (new MostBorrowedArticlesReportService($reader))->report('admin', '2026-11-01', '2026-11-30'));
    }

    public function test_non_admin_is_denied_before_reading_report_data(): void
    {
        $reader = $this->createMock(MostBorrowedReportReader::class);
        $reader->expects($this->never())->method('rows');
        $this->expectException(SecurityFailure::class);
        (new MostBorrowedArticlesReportService($reader))->report('operator', '2026-11-01', '2026-11-30');
    }
}
