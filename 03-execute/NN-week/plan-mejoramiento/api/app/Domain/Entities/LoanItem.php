<?php

namespace App\Domain\Entities;

use App\Domain\Exceptions\LoanViolation;
use DateTimeImmutable;
use DateTimeZone;

final class LoanItem
{
    public function __construct(
        public readonly string $id,
        public readonly string $loanId,
        public readonly string $articleId,
        public readonly string $articleName,
        public readonly string $articleReference,
        public readonly string $categoryName,
        public readonly DateTimeImmutable $dueAt,
        private ?DateTimeImmutable $returnedAt = null,
    ) {}

    public static function borrow(string $id, string $loanId, Article $article, DateTimeImmutable $loanedAt): self
    {
        $data = $article->publicData();

        return new self($id, $loanId, $article->id, $data['name'], $data['reference'], $data['category']['name'], $loanedAt->setTimezone(new DateTimeZone('UTC'))->modify('+3 days'));
    }

    public function isPending(): bool
    {
        return $this->returnedAt === null;
    }

    public function isOverdue(DateTimeImmutable $now): bool
    {
        return $this->isPending() && $this->dueAt->getTimestamp() < $now->getTimestamp();
    }

    public function returnAt(DateTimeImmutable $now): void
    {
        if (! $this->isPending()) {
            throw new LoanViolation('ITEM_ALREADY_RETURNED', 'El artículo del préstamo ya fue devuelto.');
        }
        $this->returnedAt = $now;
    }

    public function returnedAt(): ?DateTimeImmutable
    {
        return $this->returnedAt;
    }

    public function daysLate(DateTimeImmutable $now): int
    {
        return $this->isOverdue($now) ? (int) floor(($now->getTimestamp() - $this->dueAt->getTimestamp()) / 86400) : 0;
    }

    public static function formatDate(DateTimeImmutable $date): string
    {
        return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }

    public function publicData(): array
    {
        return ['id' => $this->id, 'article_id' => $this->articleId, 'article_name' => $this->articleName,
            'article_reference' => $this->articleReference, 'category_name' => $this->categoryName,
            'due_at' => self::formatDate($this->dueAt), 'returned_at' => $this->returnedAt === null ? null : self::formatDate($this->returnedAt)];
    }
}
