<?php

namespace App\Domain\ValueObjects;

use App\Domain\Exceptions\LoanViolation;
use DateTimeImmutable;
use DateTimeZone;

final readonly class DateRange
{
    public ?DateTimeImmutable $start;

    public ?DateTimeImmutable $endExclusive;

    public function __construct(?string $from = null, ?string $to = null)
    {
        $this->start = $from === null ? null : self::parse($from);
        $end = $to === null ? null : self::parse($to);
        if ($this->start !== null && $end !== null && $end < $this->start) {
            throw new LoanViolation('INVALID_DATE_RANGE', 'La fecha final no puede ser anterior a la inicial.');
        }
        $this->endExclusive = $end?->modify('+1 day');
    }

    private static function parse(string $value): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw new LoanViolation('INVALID_DATE_RANGE', 'Las fechas deben tener el formato AAAA-MM-DD y ser válidas.');
        }

        return $date;
    }
}
