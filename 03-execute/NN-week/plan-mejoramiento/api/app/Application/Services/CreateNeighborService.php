<?php

namespace App\Application\Services;

use App\Application\Exceptions\NeighborFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\NeighborRepository;
use App\Domain\Entities\Neighbor;
use App\Domain\ValueObjects\DocumentNumber;

final readonly class CreateNeighborService
{
    public function __construct(private NeighborRepository $neighbors, private IdGenerator $ids) {}

    public function create(string $actorRole, string $fullName, string $documentNumber): Neighbor
    {
        if (! in_array($actorRole, ['admin', 'operator'], true)) {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }
        $document = new DocumentNumber($documentNumber);
        if ($this->neighbors->documentTaken($document->value)) {
            throw new NeighborFailure('DOCUMENT_TAKEN', 409, 'El documento ya está registrado.');
        }
        $neighbor = new Neighbor($this->ids->generate(), $fullName, $document);
        $this->neighbors->create($neighbor);

        return $neighbor;
    }
}
