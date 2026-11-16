<?php

namespace Tests\Support;

use App\Application\Ports\Clock;
use DateTimeImmutable;
use DateTimeZone;

final class MutableClock implements Clock
{
    public function __construct(public DateTimeImmutable $time = new DateTimeImmutable('2026-11-15T12:00:00Z')) {}

    public function now(): DateTimeImmutable
    {
        return $this->time;
    }

    public function set(string $time): void
    {
        $this->time = new DateTimeImmutable($time, new DateTimeZone('UTC'));
    }
}
