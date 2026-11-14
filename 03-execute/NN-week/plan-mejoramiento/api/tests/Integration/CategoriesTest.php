<?php

namespace Tests\Integration;

use Illuminate\Support\Facades\DB;
use Tests\Support\PostgresTestCase;

class CategoriesTest extends PostgresTestCase
{
    public function test_initial_categories_have_exact_names_and_identifiers(): void
    {
        $this->assertSame([
            '11111111-1111-4111-8111-111111111111' => 'ollas',
            '22222222-2222-4222-8222-222222222222' => 'vajilla',
            '33333333-3333-4333-8333-333333333333' => 'cubiertos',
            '44444444-4444-4444-8444-444444444444' => 'hornillas',
            '55555555-5555-4555-8555-555555555555' => 'manteles',
        ], DB::table('category')->orderBy('id')->pluck('name', 'id')->all());
    }
}
