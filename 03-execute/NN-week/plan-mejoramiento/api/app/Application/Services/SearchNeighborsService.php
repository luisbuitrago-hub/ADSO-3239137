<?php

namespace App\Application\Services;

use App\Application\Ports\NeighborRepository;
use App\Domain\Entities\Neighbor;
use App\Domain\Exceptions\NeighborViolation;

final readonly class SearchNeighborsService
{
    public function __construct(private NeighborRepository $neighbors) {}

    public function search(?string $query, int $page = 1, int $size = 20): array
    {
        if ($page < 1 || $page > 2147483647 || $size < 1 || $size > 50) {
            throw new NeighborViolation('Los parámetros de paginación no son válidos.');
        }
        $result = $this->neighbors->search($query, $page, $size);

        return ['items' => array_map(fn (Neighbor $neighbor) => $neighbor->publicData(), $result['items']),
            'page' => $page, 'size' => $size, 'total' => $result['total']];
    }
}
