<?php

namespace Tests\Unit;

use App\Domain\Entities\Article;
use App\Domain\Entities\Category;
use App\Domain\Exceptions\CatalogViolation;
use App\Domain\ValueObjects\ArticleReference;
use App\Domain\ValueObjects\Quantity;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ArticleInventoryTest extends TestCase
{
    private function article(int $total = 5, int $available = 2): Article
    {
        return new Article('test-id', 'Olla', 'Descripción', new ArticleReference('Ref-01'), new Category('category-id', 'ollas'), new Quantity($total), new Quantity($available));
    }

    public function test_total_adjustment_preserves_borrowed_quantity(): void
    {
        $article = $this->article();
        $category = new Category('other-category', 'vajilla');
        $article->update('Otro nombre', 'Otra descripción', $category, new Quantity(8));
        $this->assertSame(5, $article->publicData()['available_units']);
        $article->update('Otro nombre', 'Otra descripción', $category, new Quantity(3));
        $this->assertSame(0, $article->publicData()['available_units']);
        $this->assertSame('Ref-01', $article->reference->value);
    }

    public function test_invalid_reduction_leaves_all_article_data_unchanged(): void
    {
        $article = $this->article();
        $original = $article->publicData();
        try {
            $article->update('No persistir', 'No persistir', new Category('another', 'vajilla'), new Quantity(2));
            $this->fail('Una reducción incompatible con las unidades prestadas debe fallar.');
        } catch (CatalogViolation $exception) {
            $this->assertSame('VALIDATION_ERROR', $exception->errorCode);
        }
        $this->assertSame($original, $article->publicData());
    }

    public static function invalidInventory(): array
    {
        return [[0, 0], [-1, 0], [1, -1], [1, 2], [2147483648, 0]];
    }

    #[DataProvider('invalidInventory')]
    public function test_invalid_inventory_cannot_enter_the_domain(int $total, int $available): void
    {
        $this->expectException(CatalogViolation::class);
        $this->article($total, $available);
    }

    public function test_deactivation_is_blocked_by_pending_lines_and_uses_the_supplied_instant(): void
    {
        $article = $this->article();
        $at = new DateTimeImmutable('2026-11-15T12:00:00Z');
        try {
            $article->deactivate($at, true);
            $this->fail('La baja con pendientes debe rechazarse.');
        } catch (CatalogViolation $exception) {
            $this->assertSame('ARTICLE_HAS_OPEN_LOANS', $exception->errorCode);
        }
        $this->assertNull($article->deletedAt());
        $article->deactivate($at, false);
        $this->assertSame($at, $article->deletedAt());
    }

    public function test_references_preserve_case_and_validate_documented_length(): void
    {
        $this->assertSame('Ref-01', (new ArticleReference('Ref-01'))->value);
        $this->expectException(CatalogViolation::class);
        new ArticleReference(str_repeat('a', 51));
    }

    public function test_empty_reference_is_rejected(): void
    {
        $this->expectException(CatalogViolation::class);
        new ArticleReference('   ');
    }
}
