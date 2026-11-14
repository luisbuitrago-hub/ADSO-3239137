<?php

namespace Tests\Integration;

use Illuminate\Support\Facades\DB;
use Tests\Support\PostgresTestCase;

class MigrationsTest extends PostgresTestCase
{
    public function test_empty_database_creates_all_tables_and_six_migration_records(): void
    {
        $tables = DB::select("SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'kitchenware' ORDER BY table_name");

        $this->assertSame(['article', 'category', 'loan', 'loan_item', 'migrations', 'neighbor', 'user'],
            array_column($tables, 'table_name'));
        $this->assertSame(6, DB::table('migrations')->count());
        $this->assertSame('UTC', DB::selectOne('SHOW timezone')->TimeZone);
        $this->assertSame('16', explode('.', DB::selectOne('SHOW server_version')->server_version)[0]);
    }

    public function test_preparation_is_repeatable_without_changing_existing_data(): void
    {
        $article = $this->article();
        DB::table('article')->insert($article);

        $this->artisan('kitchenware:prepare-database', ['--force' => true])->assertExitCode(0);

        $this->assertSame(6, DB::table('migrations')->count());
        $this->assertSame(5, DB::table('category')->count());
        $this->assertSame($article['reference'], DB::table('article')->where('id', $article['id'])->value('reference'));
    }

    public function test_business_columns_match_the_documented_model(): void
    {
        $expected = [
            'category' => ['id', 'name'],
            'article' => ['id', 'name', 'description', 'reference', 'category_id', 'total_units', 'available_units', 'cover_key', 'deleted_at'],
            'neighbor' => ['id', 'full_name', 'document_number'],
            'user' => ['id', 'username', 'password_hash', 'role'],
            'loan' => ['id', 'neighbor_id', 'loaned_by_user_id', 'loaned_at'],
            'loan_item' => ['id', 'loan_id', 'article_id', 'article_name', 'article_reference', 'category_name', 'due_at', 'returned_at'],
        ];

        foreach ($expected as $table => $names) {
            $columns = DB::select('SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns WHERE table_schema = ? AND table_name = ?
                ORDER BY ordinal_position', ['kitchenware', $table]);
            $this->assertSame($names, array_column($columns, 'column_name'), $table);

            foreach ($columns as $column) {
                $this->assertNull($column->column_default, "$table.$column->column_name");
                $this->assertSame(in_array($column->column_name, ['cover_key', 'deleted_at', 'returned_at'], true) ? 'YES' : 'NO', $column->is_nullable);
                if ($column->column_name === 'id' || str_ends_with($column->column_name, '_id')) {
                    $this->assertSame('uuid', $column->data_type);
                } elseif (str_ends_with($column->column_name, '_at')) {
                    $this->assertSame('timestamp with time zone', $column->data_type);
                }
            }
        }
    }

    public function test_foreign_keys_have_documented_delete_and_update_policies(): void
    {
        $constraints = DB::select("SELECT constraint_name, delete_rule, update_rule
            FROM information_schema.referential_constraints
            WHERE constraint_schema = 'kitchenware' ORDER BY constraint_name");

        $this->assertSame([
            'article_category_id_foreign', 'loan_item_article_id_foreign',
            'loan_item_loan_id_foreign', 'loan_loaned_by_user_id_foreign', 'loan_neighbor_id_foreign',
        ], array_column($constraints, 'constraint_name'));
        foreach ($constraints as $constraint) {
            $this->assertSame($constraint->constraint_name === 'loan_item_loan_id_foreign' ? 'CASCADE' : 'RESTRICT', $constraint->delete_rule);
            $this->assertSame('NO ACTION', $constraint->update_rule);
        }
    }

    public function test_query_indexes_and_active_reference_predicate_exist(): void
    {
        $indexes = DB::select("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'kitchenware'");
        $definitions = array_column($indexes, 'indexdef', 'indexname');

        foreach (['idx_article_category_name', 'idx_loan_loaned_at', 'idx_loan_item_article', 'idx_loan_item_pending_due', 'user_username_unique', 'uq_loan_item_loan_article'] as $name) {
            $this->assertArrayHasKey($name, $definitions);
        }
        $this->assertStringContainsString('UNIQUE INDEX', $definitions['ux_article_active_reference']);
        $this->assertStringContainsString('WHERE (deleted_at IS NULL)', $definitions['ux_article_active_reference']);
    }
}
