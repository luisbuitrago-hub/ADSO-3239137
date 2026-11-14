
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_item', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('loan_id');
            $table->foreign('loan_id')
                ->references('id')
                ->on('loan')
                ->cascadeOnDelete();

            $table->uuid('article_id');
            $table->foreign('article_id')
                ->references('id')
                ->on('article')
                ->restrictOnDelete();

            $table->string('article_name', 250);
            $table->string('article_reference', 50);
            $table->string('category_name', 120);

            $table->timestampTz('due_at');
            $table->timestampTz('returned_at')->nullable();

            $table->unique(
                ['loan_id', 'article_id'],
                'uq_loan_item_loan_article'
            );

            $table->index(
                'article_id',
                'idx_loan_item_article'
            );

            $table->index(
                ['returned_at', 'due_at'],
                'idx_loan_item_pending_due'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_item');
    }
};