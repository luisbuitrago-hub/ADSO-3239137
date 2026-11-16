<?php

namespace App\Application\Ports;

use App\Domain\Entities\Neighbor;

interface NeighborRepository
{
    public function documentTaken(string $documentNumber): bool;

    public function create(Neighbor $neighbor): void;

    /** @return array{neighbor: Neighbor, active_loans: int}|null */
    public function findWithPendingCount(string $id): ?array;

    /** @return array{items: list<Neighbor>, total: int} */
    public function search(?string $query, int $page, int $size): array;
}
