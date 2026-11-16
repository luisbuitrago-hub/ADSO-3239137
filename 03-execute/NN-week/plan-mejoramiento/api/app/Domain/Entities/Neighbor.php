<?php

namespace App\Domain\Entities;

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
}
