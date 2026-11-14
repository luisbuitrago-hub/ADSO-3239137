
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('category', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 120)->unique();
        });

        DB::table('category')->insert([
            [
                'id' => '11111111-1111-4111-8111-111111111111',
                'name' => 'ollas',
            ],
            [
                'id' => '22222222-2222-4222-8222-222222222222',
                'name' => 'vajilla',
            ],
            [
                'id' => '33333333-3333-4333-8333-333333333333',
                'name' => 'cubiertos',
            ],
            [
                'id' => '44444444-4444-4444-8444-444444444444',
                'name' => 'hornillas',
            ],
            [
                'id' => '55555555-5555-4555-8555-555555555555',
                'name' => 'manteles',
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('category');
    }
};
