
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 250);
            $table->string('description', 200);
            $table->string('reference', 50);

            $table->uuid('category_id');
            $table->foreign('category_id')
                ->references('id')
                ->on('category')
                ->restrictOnDelete();

            $table->integer('total_units');
            $table->integer('available_units');
            $table->string('cover_key', 512)->nullable();
            $table->timestampTz('deleted_at')->nullable();

            $table->index(
                ['category_id', 'name'],
                'idx_article_category_name'
            );
        });

        DB::statement(
            'ALTER TABLE kitchenware.article
             ADD CONSTRAINT ck_article_total_positive
             CHECK (total_units >= 1)'
        );

        DB::statement(
            'ALTER TABLE kitchenware.article
             ADD CONSTRAINT ck_article_available_range
             CHECK (available_units >= 0 AND available_units <= total_units)'
        );

        DB::statement(
            'CREATE UNIQUE INDEX ux_article_active_reference
             ON kitchenware.article (reference)
             WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('article');
    }
};
