<?php

namespace App\Domain\Entities;

use App\Domain\Exceptions\LoanViolation;
use App\Domain\Exceptions\NeighborViolation;
use App\Domain\ValueObjects\DocumentNumber;

final readonly class Neighbor
{
    public string $fullName;

    public function __construct(public string $id, string $fullName, public DocumentNumber $documentNumber)
    {
        $name = trim($fullName);
        if ($name === '' || mb_strlen($name) > 200) {
            throw new NeighborViolation('El nombre completo debe contener entre 1 y 200 caracteres.');
        }
        $this->fullName = $name;
    }

    public function publicData(): array
    {
        return ['id' => $this->id, 'full_name' => $this->fullName, 'document_number' => $this->documentNumber->value];
    }

    public function assertCanBorrow(int $pending, bool $hasOverdue, int $requested): void
    {
        if ($hasOverdue) {
            throw new LoanViolation('NEIGHBOR_HAS_OVERDUE', 'El vecino tiene artículos vencidos pendientes de devolución.');
        }
        if ($pending + $requested > 3) {
            throw new LoanViolation('NEIGHBOR_LIMIT_EXCEEDED', 'El vecino no puede superar tres artículos pendientes de devolución.');
        }
    }
}
