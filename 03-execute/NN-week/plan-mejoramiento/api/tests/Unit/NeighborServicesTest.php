<?php

namespace Tests\Unit;

use App\Application\Exceptions\NeighborFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\NeighborRepository;
use App\Application\Services\CreateNeighborService;
use App\Application\Services\GetNeighborService;
use App\Application\Services\SearchNeighborsService;
use App\Domain\Entities\Neighbor;
use App\Domain\Exceptions\NeighborViolation;
use App\Domain\ValueObjects\DocumentNumber;
use PHPUnit\Framework\TestCase;

class NeighborServicesTest extends TestCase
{
    public function test_creation_normalizes_documents_and_uses_injected_identifiers_and_repository(): void
    {
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->expects($this->once())->method('documentTaken')->with('001-A')->willReturn(false);
        $neighbors->expects($this->once())->method('create')->with($this->callback(fn (Neighbor $neighbor) => $neighbor->publicData() === ['id' => 'new-id', 'full_name' => 'Vecino', 'document_number' => '001-A']));
        $ids = $this->createMock(IdGenerator::class);
        $ids->method('generate')->willReturn('new-id');
        (new CreateNeighborService($neighbors, $ids))->create('operator', ' Vecino ', ' 001-A ');
    }

    public function test_duplicate_documents_are_rejected_without_writing(): void
    {
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->method('documentTaken')->with('001-A')->willReturn(true);
        $neighbors->expects($this->never())->method('create');
        try {
            (new CreateNeighborService($neighbors, $this->createMock(IdGenerator::class)))->create('admin', 'Vecino', ' 001-A ');
            $this->fail('El documento repetido debe rechazarse.');
        } catch (NeighborFailure $exception) {
            $this->assertSame('DOCUMENT_TAKEN', $exception->errorCode);
            $this->assertSame(409, $exception->status);
        }
    }

    public function test_disallowed_role_is_rejected_before_accessing_storage(): void
    {
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->expects($this->never())->method('documentTaken');
        $neighbors->expects($this->never())->method('create');
        $this->expectException(SecurityFailure::class);
        (new CreateNeighborService($neighbors, $this->createMock(IdGenerator::class)))->create('other', 'Vecino', '123');
    }

    public function test_detail_uses_the_pending_line_count_from_the_read_port(): void
    {
        $neighbor = new Neighbor('id', 'Vecino', new DocumentNumber('123'));
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->expects($this->once())->method('findWithPendingCount')->with('id')->willReturn(['neighbor' => $neighbor, 'active_loans' => 3]);
        $this->assertSame($neighbor->publicData() + ['active_loans' => 3], (new GetNeighborService($neighbors))->get('id'));
    }

    public function test_missing_neighbor_uses_the_documented_not_found_error(): void
    {
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->method('findWithPendingCount')->willReturn(null);
        try {
            (new GetNeighborService($neighbors))->get('missing');
            $this->fail('El vecino inexistente debe producir 404.');
        } catch (NeighborFailure $exception) {
            $this->assertSame('NOT_FOUND', $exception->errorCode);
            $this->assertSame(404, $exception->status);
        }
    }

    public function test_search_returns_the_contract_using_only_the_repository_port(): void
    {
        $neighbor = new Neighbor('id', 'Vecino', new DocumentNumber('001-A'));
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->expects($this->once())->method('search')->with('001', 2, 10)->willReturn(['items' => [$neighbor], 'total' => 11]);
        $this->assertSame(['items' => [$neighbor->publicData()], 'page' => 2, 'size' => 10, 'total' => 11],
            (new SearchNeighborsService($neighbors))->search('001', 2, 10));
    }

    public function test_search_rejects_invalid_pagination_before_querying(): void
    {
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->expects($this->never())->method('search');
        $this->expectException(NeighborViolation::class);
        (new SearchNeighborsService($neighbors))->search(null, 1, 51);
    }
}
