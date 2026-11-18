<?php

namespace App\Infrastructure\Persistence;

use App\Application\Ports\TransactionManager;
use Illuminate\Support\Facades\DB;

final class LaravelTransactionManager implements TransactionManager
{
    public function run(callable $operation): mixed
    {
        return DB::transaction($operation, attempts: 3);
    }

    public function afterCommit(callable $operation): void
    {
        DB::afterCommit($operation);
    }

    public function afterRollback(callable $operation): void
    {
        if (DB::transactionLevel() > 0) {
            DB::afterRollBack($operation);
        }
    }
}
