<?php

namespace App\Application\Ports;

interface TransactionManager
{
    public function run(callable $operation): mixed;

    public function afterCommit(callable $operation): void;

    public function afterRollback(callable $operation): void;
}
