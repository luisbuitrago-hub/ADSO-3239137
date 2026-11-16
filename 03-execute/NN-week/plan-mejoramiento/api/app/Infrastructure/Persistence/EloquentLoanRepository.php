<?php

namespace App\Infrastructure\Persistence;

use App\Application\Ports\LoanRepository;
use App\Domain\Entities\Loan;
use App\Domain\Entities\LoanItem;
use App\Domain\Exceptions\LoanViolation;
use App\Domain\ValueObjects\DateRange;
use App\Models\Loan as LoanModel;
use App\Models\LoanItem as LoanItemModel;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class EloquentLoanRepository implements LoanRepository
{
    public function pendingState(string $neighborId, DateTimeImmutable $now): array
    {
        $row = DB::table('loan_item')->join('loan', 'loan.id', '=', 'loan_item.loan_id')
            ->where('loan.neighbor_id', $neighborId)->whereNull('loan_item.returned_at')
            ->selectRaw('COUNT(*) AS pending_count, MIN(due_at) AS earliest_due_at')->first();
        $earliest = $row->earliest_due_at === null ? null : new DateTimeImmutable($row->earliest_due_at, new DateTimeZone('UTC'));

        return ['count' => (int) $row->pending_count, 'overdue' => $earliest !== null && $earliest->getTimestamp() < $now->getTimestamp()];
    }

    public function create(Loan $loan): void
    {
        $model = new LoanModel;
        $model->id = $loan->id;
        $model->fill(['neighbor_id' => $loan->neighborId, 'loaned_by_user_id' => $loan->loanedByUserId, 'loaned_at' => $loan->loanedAt]);
        $model->save();
        foreach ($loan->items as $item) {
            $line = new LoanItemModel;
            $line->id = $item->id;
            $line->fill(['loan_id' => $loan->id, 'article_id' => $item->articleId, 'article_name' => $item->articleName,
                'article_reference' => $item->articleReference, 'category_name' => $item->categoryName,
                'due_at' => $item->dueAt, 'returned_at' => null]);
            $line->save();
        }
    }

    public function find(string $id): ?Loan
    {
        $model = LoanModel::with(['items' => fn ($query) => $query->orderBy('id')])->whereKey($id)->first();

        return $model === null ? null : $this->toDomain($model);
    }

    public function findItem(string $loanId, string $itemId, bool $forUpdate = false): ?LoanItem
    {
        $query = LoanItemModel::where('loan_id', $loanId)->whereKey($itemId);
        if ($forUpdate) {
            $query->lockForUpdate();
        }
        $model = $query->first();

        return $model === null ? null : $this->toItem($model);
    }

    public function saveReturn(LoanItem $item): void
    {
        $updated = LoanItemModel::where('loan_id', $item->loanId)->whereKey($item->id)->whereNull('returned_at')
            ->update(['returned_at' => $item->returnedAt()]);
        if ($updated !== 1) {
            throw new LoanViolation('ITEM_ALREADY_RETURNED', 'El artículo del préstamo ya fue devuelto.');
        }
    }

    public function search(DateRange $dates, ?string $status, ?string $neighborId, int $page, int $size, DateTimeImmutable $now): array
    {
        $query = LoanModel::with(['items' => fn ($items) => $items->orderBy('id')]);
        if ($neighborId !== null) {
            $query->where('neighbor_id', $neighborId);
        }
        if ($dates->start !== null) {
            $query->where('loaned_at', '>=', $dates->start);
        }
        if ($dates->endExclusive !== null) {
            $query->where('loaned_at', '<', $dates->endExclusive);
        }
        $pending = fn (Builder $items) => $items->whereNull('returned_at');
        $overdue = fn (Builder $items) => $items->whereNull('returned_at')->where('due_at', '<', $now);
        if ($status === 'closed') {
            $query->whereDoesntHave('items', $pending);
        } elseif ($status === 'overdue') {
            $query->whereHas('items', $overdue);
        } elseif ($status === 'open') {
            $query->whereHas('items', $pending)->whereDoesntHave('items', $overdue);
        }
        $total = (clone $query)->count();
        $items = $query->orderByDesc('loaned_at')->orderBy('id')->offset(($page - 1) * $size)->limit($size)->get()
            ->map(fn (LoanModel $model) => $this->toDomain($model))->all();

        return ['items' => $items, 'total' => $total];
    }

    public function overdue(DateTimeImmutable $now): array
    {
        return LoanItemModel::with('loan.neighbor')->whereNull('returned_at')->where('due_at', '<', $now)
            ->orderBy('due_at')->orderBy('id')->get()->map(function (LoanItemModel $model) use ($now): array {
                $item = $this->toItem($model);

                return ['loan_id' => $item->loanId, 'item_id' => $item->id, 'article_name' => $item->articleName,
                    'neighbor_name' => $model->loan->neighbor->full_name, 'due_at' => LoanItem::formatDate($item->dueAt), 'days_late' => $item->daysLate($now)];
            })->all();
    }

    private function toDomain(LoanModel $model): Loan
    {
        return new Loan($model->id, $model->neighbor_id, $model->loaned_by_user_id, $model->loaned_at->toDateTimeImmutable(),
            $model->items->map(fn (LoanItemModel $item) => $this->toItem($item))->all());
    }

    private function toItem(LoanItemModel $item): LoanItem
    {
        return new LoanItem($item->id, $item->loan_id, $item->article_id, $item->article_name,
            $item->article_reference, $item->category_name, $item->due_at->toDateTimeImmutable(), $item->returned_at?->toDateTimeImmutable());
    }
}
