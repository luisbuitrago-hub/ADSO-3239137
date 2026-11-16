<?php

namespace Tests\Support;

use App\Application\Ports\Clock;
use App\Application\Services\LoginService;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

trait LoanFixtures
{
    protected MutableClock $loanClock;

    protected User $loanActor;

    protected array $borrower;

    protected function initializeLoans(): void
    {
        config(['jwt.secret' => bin2hex(random_bytes(32)), 'jwt.algo' => 'HS256', 'hashing.bcrypt.rounds' => 4]);
        $this->loanClock = new MutableClock;
        $this->app->instance(Clock::class, $this->loanClock);
        $this->loanActor = User::factory()->create(['username' => 'loan-operator', 'role' => 'operator', 'password_hash' => Hash::driver('bcrypt')->make('Loan scenario fixture!')]);
        $this->withToken(app(LoginService::class)->login($this->loanActor->username, 'Loan scenario fixture!')['access_token']);
        $this->borrower = $this->makeBorrower();
    }

    protected function makeBorrower(): array
    {
        $row = ['id' => (string) Str::uuid(), 'full_name' => 'Vecino de prueba', 'document_number' => substr(str_replace('-', '', (string) Str::uuid()), 0, 24)];
        DB::table('neighbor')->insert($row);

        return $row;
    }

    protected function makeArticle(array $changes = []): array
    {
        $number = DB::table('article')->count() + 1;
        $row = array_replace(['id' => (string) Str::uuid(), 'name' => 'Artículo '.$number, 'description' => 'Menaje',
            'reference' => 'ART-'.$number, 'category_id' => '11111111-1111-4111-8111-111111111111', 'total_units' => 2, 'available_units' => 2], $changes);
        DB::table('article')->insert($row);

        return $row;
    }

    protected function loanPayload(array $articles, ?array $neighbor = null): array
    {
        return ['neighbor_id' => ($neighbor ?? $this->borrower)['id'], 'items' => array_map(fn (array $article) => ['article_id' => $article['id']], $articles)];
    }

    protected function lend(array $articles, ?array $neighbor = null): array
    {
        return $this->postJson('/api/v1/loans', $this->loanPayload($articles, $neighbor))->assertCreated()->json();
    }

    protected function returnPath(array $loan, int $index = 0): string
    {
        return '/api/v1/loans/'.$loan['id'].'/items/'.$loan['items'][$index]['id'].'/return';
    }
}
