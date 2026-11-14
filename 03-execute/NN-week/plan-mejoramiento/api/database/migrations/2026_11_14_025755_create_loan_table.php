
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('neighbor_id');
            $table->foreign('neighbor_id')
                ->references('id')
                ->on('neighbor')
                ->restrictOnDelete();

            $table->uuid('loaned_by_user_id');
            $table->foreign('loaned_by_user_id')
                ->references('id')
                ->on('user')
                ->restrictOnDelete();

            $table->timestampTz('loaned_at');

            $table->index('loaned_at', 'idx_loan_loaned_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan');
    }
};