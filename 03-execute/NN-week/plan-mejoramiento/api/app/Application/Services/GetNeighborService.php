<?php

namespace App\Application\Services;

use App\Application\Exceptions\NeighborFailure;
use App\Application\Ports\NeighborRepository;

final readonly class GetNeighborService
{
    public function __construct(private NeighborRepository $neighbors) {}

    public function get(string $id): array
    {
        $result = $this->neighbors->findWithPendingCount($id)
            ?? throw new NeighborFailure('NOT_FOUND', 404, 'El vecino solicitado no existe.');

        return $result['neighbor']->publicData() + ['active_loans' => $result['active_loans']];
    }
}
