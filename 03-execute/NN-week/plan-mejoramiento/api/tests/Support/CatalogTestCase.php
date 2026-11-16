<?php

namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

abstract class CatalogTestCase extends SecurityTestCase
{
    protected const POTS = '11111111-1111-4111-8111-111111111111';

    protected const DISHES = '22222222-2222-4222-8222-222222222222';

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('category', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
        });
        foreach (['ollas', 'vajilla', 'cubiertos', 'hornillas', 'manteles'] as $index => $name) {
            $digit = (string) ($index + 1);
            DB::table('category')->insert(['id' => str_repeat($digit, 8).'-'.str_repeat($digit, 4).'-4'.str_repeat($digit, 3).'-8'.str_repeat($digit, 3).'-'.str_repeat($digit, 12), 'name' => $name]);
        }
        Schema::create('article', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('description');
            $table->string('reference');
            $table->uuid('category_id');
            $table->integer('total_units');
            $table->integer('available_units');
            $table->string('cover_key')->nullable();
            $table->timestampTz('deleted_at')->nullable();
        });
        DB::statement('CREATE UNIQUE INDEX ux_article_active_reference ON article (reference) WHERE deleted_at IS NULL');
        Schema::create('loan_item', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('article_id');
            $table->timestampTz('returned_at')->nullable();
        });
    }

    protected function articleData(array $overrides = []): array
    {
        return array_replace(['name' => 'Olla grande', 'description' => 'Olla de aluminio',
            'reference' => 'OLL-001', 'category_id' => self::POTS, 'total_units' => 5], $overrides);
    }

    protected function storedArticle(array $overrides = []): array
    {
        $row = array_replace(['id' => (string) Str::uuid(), 'available_units' => 5], $this->articleData(), $overrides);
        DB::table('article')->insert($row);

        return $row;
    }

    protected function authenticate(string $role = 'admin'): void
    {
        $this->withToken($this->tokenFor($this->user($role, $role)));
    }
}
