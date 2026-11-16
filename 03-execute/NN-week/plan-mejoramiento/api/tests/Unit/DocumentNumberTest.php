<?php

namespace Tests\Unit;

use App\Domain\Exceptions\NeighborViolation;
use App\Domain\ValueObjects\DocumentNumber;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class DocumentNumberTest extends TestCase
{
    public function test_normalization_preserves_zeros_case_and_separators(): void
    {
        $this->assertSame('000Ab-01.2 /X', (new DocumentNumber(" \t000Ab-01.2 /X \n"))->value);
        $this->assertSame(str_repeat('ñ', 30), (new DocumentNumber(' '.str_repeat('ñ', 30).' '))->value);
    }

    public static function invalidDocuments(): array
    {
        return [[''], [" \t\n"], [str_repeat('a', 31)]];
    }

    #[DataProvider('invalidDocuments')]
    public function test_invalid_documents_are_rejected_without_framework(string $value): void
    {
        $this->expectException(NeighborViolation::class);
        new DocumentNumber($value);
    }
}
