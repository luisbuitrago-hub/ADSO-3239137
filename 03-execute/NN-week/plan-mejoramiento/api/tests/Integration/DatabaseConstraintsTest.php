<?php

namespace Tests\Integration;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PostgresTestCase;

class DatabaseConstraintsTest extends PostgresTestCase
{
    public static function invalidQuantities(): array
    {
        return [
            'zero total' => [['total_units' => 0, 'available_units' => 0], 'ck_article_total_positive'],
            // Ambas restricciones rechazan este caso; no dependemos de su orden.
            'negative total' => [['total_units' => -1, 'available_units' => 0], ['ck_article_total_positive', 'ck_article_available_range']],
            'negative available' => [['available_units' => -1], 'ck_article_available_range'],
            'available above total' => [['available_units' => 3], 'ck_article_available_range'],
        ];
    }

    #[DataProvider('invalidQuantities')]
    public function test_invalid_inventory_is_rejected(array $overrides, string|array $constraint): void
    {
        $this->assertRejected(fn () => DB::table('article')->insert($this->article($overrides)), '23514', $constraint);
        $this->assertSame(0, DB::table('article')->count());
    }

    public function test_inventory_boundaries_are_allowed(): void
    {
        DB::table('article')->insert($this->article(['total_units' => 1, 'available_units' => 0]));
        DB::table('article')->insert($this->article(['reference' => 'OLL-002', 'total_units' => 1, 'available_units' => 1]));
        $this->assertSame(2, DB::table('article')->count());
    }

    public function test_only_documented_roles_are_allowed(): void
    {
        foreach (['admin', 'operator'] as $role) {
            DB::table('user')->insert(['id' => (string) Str::uuid(), 'username' => $role, 'password_hash' => 'test-hash', 'role' => $role]);
        }
        $this->assertRejected(fn () => DB::table('user')->insert([
            'id' => (string) Str::uuid(), 'username' => 'other', 'password_hash' => 'test-hash', 'role' => 'neighbor',
        ]), '23514', 'ck_user_role');
        $this->assertSame(2, DB::table('user')->count());
    }

    public static function uniqueFields(): array
    {
        return [
            'category name' => ['category', ['name' => 'ollas'], 'category_name_unique'],
            'neighbor document' => ['neighbor', ['full_name' => 'Vecino', 'document_number' => '123'], 'neighbor_document_number_unique'],
            'username' => ['user', ['username' => 'operator', 'password_hash' => 'test-hash', 'role' => 'operator'], 'user_username_unique'],
        ];
    }

    #[DataProvider('uniqueFields')]
    public function test_unique_business_fields_are_enforced(string $table, array $values, string $constraint): void
    {
        if ($table !== 'category') {
            DB::table($table)->insert(['id' => (string) Str::uuid()] + $values);
        }
        $this->assertRejected(fn () => DB::table($table)->insert(['id' => (string) Str::uuid()] + $values), '23505', $constraint);
    }

    public function test_reference_is_unique_only_for_active_articles(): void
    {
        $article = $this->article();
        DB::table('article')->insert($article);
        $this->assertRejected(fn () => DB::table('article')->insert($this->article()), '23505', 'ux_article_active_reference');

        DB::table('article')->where('id', $article['id'])->update(['deleted_at' => '2026-11-14 12:00:00+00']);
        DB::table('article')->insert($this->article());
        $this->assertSame(2, DB::table('article')->count());
    }

    public function test_foreign_keys_reject_missing_references(): void
    {
        $this->assertRejected(fn () => DB::table('article')->insert($this->article(['category_id' => (string) Str::uuid()])), '23503', 'article_category_id_foreign');
    }

    public function test_loan_cannot_repeat_the_same_article(): void
    {
        $item = $this->loanItem();
        DB::table('loan_item')->insert($item);
        $this->assertRejected(fn () => DB::table('loan_item')->insert(array_replace($item, ['id' => (string) Str::uuid()])), '23505', 'uq_loan_item_loan_article');
        $this->assertSame(1, DB::table('loan_item')->count());
    }

    public function test_referenced_records_cannot_be_deleted(): void
    {
        $item = $this->loanItem();
        DB::table('loan_item')->insert($item);
        $loan = DB::table('loan')->where('id', $item['loan_id'])->first();

        foreach ([
            ['category', '11111111-1111-4111-8111-111111111111', 'article_category_id_foreign'],
            ['article', $item['article_id'], 'loan_item_article_id_foreign'],
            ['neighbor', $loan->neighbor_id, 'loan_neighbor_id_foreign'],
            ['user', $loan->loaned_by_user_id, 'loan_loaned_by_user_id_foreign'],
        ] as [$table, $id, $constraint]) {
            $this->assertRejected(fn () => DB::table($table)->where('id', $id)->delete(), '23503', $constraint);
        }
    }
}
