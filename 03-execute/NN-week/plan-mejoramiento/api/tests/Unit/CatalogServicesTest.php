<?php

namespace Tests\Unit;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\CategoryRepository;
use App\Application\Ports\Clock;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\TransactionManager;
use App\Application\Services\CreateArticleService;
use App\Application\Services\DeactivateArticleService;
use App\Application\Services\UpdateArticleService;
use App\Domain\Entities\Article;
use App\Domain\Entities\Category;
use App\Domain\Exceptions\CatalogViolation;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\Quantity;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class CatalogServicesTest extends TestCase
{
    private function article(): Article
    {
        return new Article('id', 'Olla', 'Descripción', new ArticleReference('REF'), new Category('category', 'ollas'), new Quantity(5), new Quantity(2));
    }

    private function transactions(): TransactionManager
    {
        $transactions = $this->createMock(TransactionManager::class);
        $transactions->expects($this->once())->method('run')->willReturnCallback(fn (callable $operation) => $operation());

        return $transactions;
    }

    public function test_creation_initializes_equal_total_and_availability_using_only_ports(): void
    {
        $articles = $this->createMock(ArticleRepository::class);
        $articles->method('referenceTaken')->willReturn(false);
        $articles->expects($this->once())->method('create')->with($this->callback(fn (Article $article) => $article->publicData()['available_units'] === 3 && $article->id === 'new-id'));
        $categories = $this->createMock(CategoryRepository::class);
        $categories->method('find')->with('category')->willReturn(new Category('category', 'ollas'));
        $ids = $this->createMock(IdGenerator::class);
        $ids->method('generate')->willReturn('new-id');
        (new CreateArticleService($articles, $categories, $ids))->create('admin', [
            'name' => 'Olla', 'description' => 'Descripción', 'reference' => 'REF', 'category_id' => 'category', 'total_units' => 3,
        ]);
    }

    public function test_duplicate_reference_is_rejected_before_saving(): void
    {
        $articles = $this->createMock(ArticleRepository::class);
        $articles->method('referenceTaken')->willReturn(true);
        $articles->expects($this->never())->method('create');
        $categories = $this->createMock(CategoryRepository::class);
        $categories->method('find')->willReturn(new Category('category', 'ollas'));
        $this->expectException(CatalogFailure::class);
        (new CreateArticleService($articles, $categories, $this->createMock(IdGenerator::class)))->create('admin', [
            'name' => 'Olla', 'description' => 'Descripción', 'reference' => 'REF', 'category_id' => 'category', 'total_units' => 3,
        ]);
    }

    public function test_update_locks_before_calculating_availability_and_saves_inside_transaction(): void
    {
        $articles = $this->createMock(ArticleRepository::class);
        $articles->expects($this->once())->method('findActive')->with('id', true)->willReturn($this->article());
        $articles->expects($this->once())->method('save')->with($this->callback(fn (Article $article) => $article->publicData()['available_units'] === 4));
        $categories = $this->createMock(CategoryRepository::class);
        $categories->method('find')->willReturn(new Category('category', 'ollas'));
        (new UpdateArticleService($articles, $categories, $this->transactions()))->update('admin', 'id', ['total_units' => 7]);
    }

    public function test_invalid_reduction_never_reaches_persistence(): void
    {
        $articles = $this->createMock(ArticleRepository::class);
        $articles->method('findActive')->willReturn($this->article());
        $articles->expects($this->never())->method('save');
        $categories = $this->createMock(CategoryRepository::class);
        $categories->method('find')->willReturn(new Category('category', 'ollas'));
        $this->expectException(CatalogViolation::class);
        (new UpdateArticleService($articles, $categories, $this->transactions()))->update('admin', 'id', ['total_units' => 2]);
    }

    public function test_deactivation_checks_pending_loans_with_a_locked_article(): void
    {
        $articles = $this->createMock(ArticleRepository::class);
        $articles->expects($this->once())->method('findActive')->with('id', true)->willReturn($this->article());
        $articles->method('hasOpenLoans')->with('id')->willReturn(true);
        $articles->expects($this->never())->method('save');
        $clock = $this->createMock(Clock::class);
        $clock->method('now')->willReturn(new DateTimeImmutable('2026-11-15T12:00:00Z'));
        $this->expectException(CatalogViolation::class);
        (new DeactivateArticleService($articles, $this->transactions(), $clock))->deactivate('admin', 'id');
    }

    public function test_application_rejects_operator_writes_without_accessing_storage(): void
    {
        $articles = $this->createMock(ArticleRepository::class);
        $articles->expects($this->never())->method('create');
        $articles->expects($this->never())->method('referenceTaken');
        $this->expectException(SecurityFailure::class);
        (new CreateArticleService($articles, $this->createMock(CategoryRepository::class), $this->createMock(IdGenerator::class)))->create('operator', []);
    }
}
