<?php

namespace App\Domain\Entities;

use App\Domain\Exceptions\LoanViolation;
use DateTimeImmutable;

final readonly class Loan
{
    /** @param list<LoanItem> $items */
    public function __construct(public string $id, public string $neighborId, public string $loanedByUserId, public DateTimeImmutable $loanedAt, public array $items)
    {
        self::validateArticleIds(array_map(fn (LoanItem $item) => $item->articleId, $items));
        foreach ($items as $item) {
            if ($item->loanId !== $id) {
                throw new LoanViolation('VALIDATION_ERROR', 'La línea no pertenece al préstamo.');
            }
        }
    }

    public static function validateArticleIds(array $ids): void
    {
        if (count($ids) < 1 || count($ids) > 3) {
            throw new LoanViolation('VALIDATION_ERROR', 'El préstamo debe contener entre uno y tres artículos.');
        }
        if (count(array_unique(array_map('strtolower', $ids))) !== count($ids)) {
            throw new LoanViolation('DUPLICATE_ARTICLE_IN_LOAN', 'Un artículo no puede repetirse en el mismo préstamo.');
        }
    }

    public function item(string $id): LoanItem
    {
        foreach ($this->items as $item) {
            if ($item->id === $id) {
                return $item;
            }
        }
        throw new LoanViolation('NOT_FOUND', 'La línea solicitada no pertenece al préstamo.');
    }

    public function status(DateTimeImmutable $now): string
    {
        $pending = false;
        foreach ($this->items as $item) {
            if ($item->isOverdue($now)) {
                return 'overdue';
            }
            $pending = $pending || $item->isPending();
        }

        return $pending ? 'open' : 'closed';
    }

    public function publicData(DateTimeImmutable $now): array
    {
        return ['id' => $this->id, 'neighbor_id' => $this->neighborId, 'loaned_at' => LoanItem::formatDate($this->loanedAt),
            'status' => $this->status($now), 'items' => array_map(fn (LoanItem $item) => $item->publicData(), $this->items)];
    }
}
