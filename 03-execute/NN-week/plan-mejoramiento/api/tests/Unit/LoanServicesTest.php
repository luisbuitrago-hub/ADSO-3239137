<?php

namespace Tests\Unit;

use App\Application\Ports\ArticleRepository;
use App\Application\Ports\Clock;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\LoanRepository;
use App\Application\Ports\NeighborRepository;
use App\Application\Ports\TransactionManager;
use App\Application\Services\LendArticlesService;
use App\Application\Services\ReturnItemService;
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
use PHPUnit\Framework\TestCase;

class LoanServicesTest extends TestCase
{
    private function article(string $id, int $available = 1): Article
    {
        return new Article($id, 'Olla', 'Descripción', new ArticleReference('REF-'.$id), new Category('category', 'ollas'), new Quantity(1), new Quantity($available));
    }

    private function transactions(): TransactionManager
    {
        $port = $this->createMock(TransactionManager::class);
        $port->expects($this->once())->method('run')->willReturnCallback(fn ($operation) => $operation());

        return $port;
    }

    private function clock(): Clock
    {
        $clock = $this->createMock(Clock::class);
        $clock->method('now')->willReturn(new DateTimeImmutable('2026-11-15T12:00:00Z'));

        return $clock;
    }

    public function test_lending_locks_neighbor_then_sorted_articles_and_persists_only_through_ports(): void
    {
        $order = [];
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->method('lock')->willReturnCallback(function () use (&$order) {
            $order[] = 'neighbor';

            return new Neighbor('neighbor', 'Vecino', new DocumentNumber('123'));
        });
        $articles = $this->createMock(ArticleRepository::class);
        $articles->method('findActive')->willReturnCallback(function ($id, $forUpdate) use (&$order) {
            $this->assertTrue($forUpdate);
            $order[] = $id;

            return $this->article($id);
        });
        $articles->expects($this->exactly(2))->method('save')->with($this->callback(fn (Article $article) => $article->publicData()['available_units'] === 0));
        $loans = $this->createMock(LoanRepository::class);
        $loans->method('pendingState')->willReturn(['count' => 0, 'overdue' => false]);
        $loans->expects($this->once())->method('create')->with($this->callback(fn (Loan $loan) => $loan->loanedByUserId === 'actor' && count($loan->items) === 2));
        $ids = $this->createMock(IdGenerator::class);
        $ids->method('generate')->willReturnOnConsecutiveCalls('loan', 'item-b', 'item-a');
        $result = (new LendArticlesService($loans, $neighbors, $articles, $this->transactions(), $this->clock(), $ids))->lend('actor', 'operator', 'neighbor', ['b', 'a']);
        $this->assertSame(['neighbor', 'a', 'b'], $order);
        $this->assertSame('b', $result['items'][0]['article_id']);
    }

    public function test_return_locks_membership_and_saves_only_returned_at_and_inventory(): void
    {
        $at = new DateTimeImmutable('2026-11-15T12:00:00Z');
        $item = LoanItem::borrow('item', 'loan', $this->article('a'), $at);
        $loan = new Loan('loan', 'neighbor', 'actor', $at, [$item]);
        $loans = $this->createMock(LoanRepository::class);
        $loans->method('find')->willReturn($loan);
        $loans->expects($this->once())->method('findItem')->with('loan', 'item', true)->willReturn($item);
        $loans->expects($this->once())->method('saveReturn')->with($this->callback(fn (LoanItem $line) => ! $line->isPending()));
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->method('lock')->willReturn(new Neighbor('neighbor', 'Vecino', new DocumentNumber('123')));
        $articles = $this->createMock(ArticleRepository::class);
        $articles->expects($this->once())->method('findIncludingInactive')->with('a', true)->willReturn($this->article('a', 0));
        $articles->expects($this->once())->method('save')->with($this->callback(fn (Article $article) => $article->publicData()['available_units'] === 1));
        $result = (new ReturnItemService($loans, $neighbors, $articles, $this->transactions(), $this->clock()))->returnItem('operator', 'loan', 'item');
        $this->assertSame('2026-11-15T12:00:00Z', $result['returned_at']);
    }

    public function test_overdue_is_checked_again_after_article_lock_wait(): void
    {
        $neighbors = $this->createMock(NeighborRepository::class);
        $neighbors->method('lock')->willReturn(new Neighbor('neighbor', 'Vecino', new DocumentNumber('123')));
        $articles = $this->createMock(ArticleRepository::class);
        $articles->method('findActive')->willReturn($this->article('a'));
        $articles->expects($this->never())->method('save');
        $loans = $this->createMock(LoanRepository::class);
        $loans->expects($this->exactly(2))->method('pendingState')->willReturnOnConsecutiveCalls(['count' => 1, 'overdue' => false], ['count' => 1, 'overdue' => true]);
        $loans->expects($this->never())->method('create');
        $this->expectException(LoanViolation::class);
        (new LendArticlesService($loans, $neighbors, $articles, $this->transactions(), $this->clock(), $this->createMock(IdGenerator::class)))
            ->lend('actor', 'operator', 'neighbor', ['a']);
    }
}
