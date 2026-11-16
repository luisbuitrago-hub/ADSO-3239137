<?php

namespace App\Infrastructure\Persistence;

use App\Application\Exceptions\NeighborFailure;
use App\Application\Ports\NeighborRepository;
use App\Domain\Entities\Neighbor;
use App\Domain\ValueObjects\DocumentNumber;
use App\Models\Neighbor as NeighborModel;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final class EloquentNeighborRepository implements NeighborRepository
{
    public function documentTaken(string $documentNumber): bool
    {
        return NeighborModel::where('document_number', $documentNumber)->exists();
    }

    public function create(Neighbor $neighbor): void
    {
        try {
            // El savepoint conserva las transacciones exteriores ante una colisión concurrente.
            DB::transaction(function () use ($neighbor): void {
                $model = new NeighborModel;
                $model->id = $neighbor->id;
                $model->full_name = $neighbor->fullName;
                $model->document_number = $neighbor->documentNumber->value;
                $model->save();
            });
        } catch (UniqueConstraintViolationException $exception) {
            if (str_contains($exception->getMessage(), 'neighbor_document_number_unique')
                || str_contains($exception->getMessage(), 'neighbor.document_number')) {
                throw new NeighborFailure('DOCUMENT_TAKEN', 409, 'El documento ya está registrado.');
            }
            throw $exception;
        }
    }

    public function findWithPendingCount(string $id): ?array
    {
        // Una sola consulta obtiene identidad y conteo, sin depender del catálogo ni de fechas.
        $pending = DB::table('loan_item')->join('loan', 'loan.id', '=', 'loan_item.loan_id')
            ->whereColumn('loan.neighbor_id', 'neighbor.id')->whereNull('loan_item.returned_at')->selectRaw('COUNT(*)');
        $model = NeighborModel::select('neighbor.*')->selectSub($pending, 'active_loans')->whereKey($id)->first();

        return $model === null ? null : ['neighbor' => $this->toDomain($model), 'active_loans' => (int) $model->active_loans];
    }

    public function search(?string $query, int $page, int $size): array
    {
        $builder = NeighborModel::query();
        if ($query !== null && $query !== '') {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query).'%';
            $operator = DB::connection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
            $builder->whereRaw("(full_name $operator ? ESCAPE '!' OR document_number $operator ? ESCAPE '!')", [$pattern, $pattern]);
        }
        $total = (clone $builder)->count();
        $items = $builder->orderBy('full_name')->orderBy('id')->offset(($page - 1) * $size)->limit($size)->get()
            ->map(fn (NeighborModel $model) => $this->toDomain($model))->all();

        return ['items' => $items, 'total' => $total];
    }

    private function toDomain(NeighborModel $model): Neighbor
    {
        return new Neighbor($model->id, $model->full_name, new DocumentNumber($model->document_number));
    }
}
