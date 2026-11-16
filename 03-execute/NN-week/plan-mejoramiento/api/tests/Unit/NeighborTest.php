<?php

namespace Tests\Unit;

use App\Domain\Entities\Neighbor;
use App\Domain\Exceptions\NeighborViolation;
use App\Domain\ValueObjects\DocumentNumber;
use PHPUnit\Framework\TestCase;

class NeighborTest extends TestCase
{
    public function test_neighbor_has_only_documented_identity_data(): void
    {
        $neighbor = new Neighbor('test-id', ' María Perez ', new DocumentNumber('001-A'));
        $this->assertSame(['id' => 'test-id', 'full_name' => 'María Perez', 'document_number' => '001-A'], $neighbor->publicData());
    }

    public function test_blank_names_are_rejected(): void
    {
        $this->expectException(NeighborViolation::class);
        new Neighbor('test-id', '   ', new DocumentNumber('123'));
    }

    public function test_overlong_names_are_rejected(): void
    {
        $this->expectException(NeighborViolation::class);
        new Neighbor('test-id', str_repeat('a', 201), new DocumentNumber('123'));
    }
}
