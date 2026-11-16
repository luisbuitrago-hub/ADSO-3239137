<?php

namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

abstract class LoanTestCase extends CatalogTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('neighbor', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('document_number')->unique();
        });
        Schema::create('loan', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('neighbor_id');
            $table->uuid('loaned_by_user_id');
            $table->timestampTz('loaned_at');
        });
        Schema::table('loan_item', function (Blueprint $table): void {
            $table->uuid('loan_id');
            $table->string('article_name');
            $table->string('article_reference');
            $table->string('category_name');
            $table->timestampTz('due_at');
            $table->unique(['loan_id', 'article_id']);
        });
    }
}
