<?php

namespace Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

abstract class NeighborTestCase extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('neighbor', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name', 200);
            $table->string('document_number', 30)->unique();
        });
        Schema::create('loan', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('neighbor_id');
        });
        Schema::create('loan_item', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('loan_id');
            $table->uuid('article_id');
            $table->timestampTz('due_at');
            $table->timestampTz('returned_at')->nullable();
        });
    }

    protected function authenticate(string $role = 'admin'): void
    {
        $this->withToken($this->tokenFor($this->user($role, $role)));
    }

    protected function neighbor(array $changes = []): array
    {
        $row = array_replace(['id' => (string) Str::uuid(), 'full_name' => 'Carlos Perez', 'document_number' => '001-A'], $changes);
        DB::table('neighbor')->insert($row);

        return $row;
    }

    protected function loanFor(string $neighborId, array $returnedFlags): void
    {
        $loanId = (string) Str::uuid();
        DB::table('loan')->insert(['id' => $loanId, 'neighbor_id' => $neighborId]);
        foreach ($returnedFlags as $returned) {
            DB::table('loan_item')->insert([
                'id' => (string) Str::uuid(), 'loan_id' => $loanId, 'article_id' => (string) Str::uuid(),
                'due_at' => '2020-01-01 12:00:00', 'returned_at' => $returned ? '2020-01-02 12:00:00' : null,
            ]);
        }
    }
}
