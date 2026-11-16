<?php

namespace App\Application\Ports;

interface TransactionManager
{
    public function run(callable $operation): mixed;
}
