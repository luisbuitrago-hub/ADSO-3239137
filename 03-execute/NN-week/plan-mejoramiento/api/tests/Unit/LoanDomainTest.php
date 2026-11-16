<?php

namespace Tests\Unit;

use App\Domain\Entities\Article;
use App\Domain\Entities\Category;
use App\Domain\Entities\Loan;
use App\Domain\Entities\LoanItem;
use App\Domain\Entities\Neighbor;
use App\Domain\Exceptions\LoanViolation;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\DocumentNumber;
use App\Domain\ValueObjects\Quantity;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\TestCase;

class LoanDomainTest extends TestCase
{
    private function article(int $available = 1): Article
    {
        return new Article('article', 'Olla original', 'Descripción', new ArticleReference('REF'), new Category('category', 'ollas'), new Quantity(1), new Quantity($available));
    }

    public function test_deadline_is_seventy_two_hours_in_utc_even_across_daylight_saving(): void
    {
        $at = new DateTimeImmutable('2026-03-28 12:00:00', new DateTimeZone('Europe/Paris'));
        $item = LoanItem::borrow('item', 'loan', $this->article(), $at);
        $this->assertSame(259200, $item->dueAt->getTimestamp() - $at->getTimestamp());
        $this->assertSame('2026-03-31T11:00:00Z', $item->publicData()['due_at']);
    }

    public function test_calculated_states_respect_exact_due_boundary_and_all_returns(): void
    {
        $at = new DateTimeImmutable('2026-11-15T12:00:00Z');
        $item = LoanItem::borrow('item', 'loan', $this->article(), $at);
        $loan = new Loan('loan', 'neighbor', 'operator', $at, [$item]);
        $this->assertSame('open', $loan->status($item->dueAt));
        $later = $item->dueAt->modify('+1 second');
        $this->assertSame('overdue', $loan->status($later));
        $this->assertSame(0, $item->daysLate($later));
        $item->returnAt($later);
        $this->assertSame('closed', $loan->status($later));
        $this->expectException(LoanViolation::class);
        $item->returnAt($later);
    }

    public function test_snapshots_do_not_follow_later_catalog_changes(): void
    {
        $article = $this->article();
        $item = LoanItem::borrow('item', 'loan', $article, new DateTimeImmutable('2026-11-15T12:00:00Z'));
        $before = $item->publicData();
        $article->update('Nombre actualizado', 'Otra descripción', new Category('other', 'vajilla'), new Quantity(2));
        $this->assertSame($before, $item->publicData());
    }

    public function test_withdraw_and_restock_protect_inventory_boundaries(): void
    {
        $article = $this->article();
        $article->withdraw();
        $this->assertSame(0, $article->publicData()['available_units']);
        try {
            $article->withdraw();
            $this->fail('No debe prestarse una unidad inexistente.');
        } catch (LoanViolation $e) {
            $this->assertSame('ARTICLE_NOT_AVAILABLE', $e->errorCode);
        }
        $article->restock();
        $this->assertSame(1, $article->publicData()['available_units']);
        $this->expectException(LoanViolation::class);
        $article->restock();
    }

    public function test_inactive_article_cannot_be_borrowed(): void
    {
        $article = $this->article();
        $article->deactivate(new DateTimeImmutable('2026-11-15T12:00:00Z'), false);
        $this->expectException(LoanViolation::class);
        $article->withdraw();
    }

    public function test_duplicate_and_empty_article_lists_are_rejected(): void
    {
        try {
            Loan::validateArticleIds(['a', 'A']);
            $this->fail('Duplicado no rechazado.');
        } catch (LoanViolation $e) {
            $this->assertSame('DUPLICATE_ARTICLE_IN_LOAN', $e->errorCode);
        }
        $this->expectException(LoanViolation::class);
        Loan::validateArticleIds([]);
    }

    public function test_neighbor_limit_and_overdue_rules_do_not_require_framework(): void
    {
        $neighbor = new Neighbor('neighbor', 'Vecino', new DocumentNumber('123'));
        $neighbor->assertCanBorrow(2, false, 1);
        try {
            $neighbor->assertCanBorrow(2, false, 2);
            $this->fail('Límite no rechazado.');
        } catch (LoanViolation $e) {
            $this->assertSame('NEIGHBOR_LIMIT_EXCEEDED', $e->errorCode);
        }
        try {
            $neighbor->assertCanBorrow(1, true, 1);
            $this->fail('Vencimiento no rechazado.');
        } catch (LoanViolation $e) {
            $this->assertSame('NEIGHBOR_HAS_OVERDUE', $e->errorCode);
        }
    }
}
