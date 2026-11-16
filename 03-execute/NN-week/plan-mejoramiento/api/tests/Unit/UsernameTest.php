<?php

namespace Tests\Unit;

use App\Domain\ValueObjects\Username;
use PHPUnit\Framework\TestCase;

class UsernameTest extends TestCase
{
    public function test_usernames_are_trimmed_and_lowercased(): void
    {
        $this->assertSame('óperador', (new Username(' ÓPERADOR '))->value);
    }

    public function test_blank_names_are_invalid(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Username('   ');
    }

    public function test_overlong_names_are_invalid(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Username(str_repeat('a', 121));
    }
}
