
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('username', 120)->unique();
            $table->string('password_hash', 512);
            $table->string('role', 40);
        });

        DB::statement(
            "ALTER TABLE kitchenware.\"user\"
             ADD CONSTRAINT ck_user_role
             CHECK (role IN ('admin', 'operator'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('user');
    }
};