<?php

namespace App\Application\Services;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\Clock;
use App\Application\Ports\LoanRepository;
use App\Application\Ports\NeighborRepository;
use App\Application\Ports\TransactionManager;
use App\Domain\Exceptions\LoanViolation;

final readonly class ReturnItemService
{
    public function __construct(private LoanRepository $loans, private NeighborRepository $neighbors,
        private ArticleRepository $articles, private TransactionManager $transactions, private Clock $clock) {}

    public function returnItem(string $actorRole, string $loanId, string $itemId): array
    {
        if (! in_array($actorRole, ['admin', 'operator'], true)) {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }

        return $this->transactions->run(function () use ($loanId, $itemId): array {
            $loan = $this->loans->find($loanId) ?? throw new LoanViolation('NOT_FOUND', 'El préstamo solicitado no existe.');
            $initial = $loan->item($itemId);
            $this->neighbors->lock($loan->neighborId) ?? throw new LoanViolation('NOT_FOUND', 'El vecino solicitado no existe.');
            $article = $this->articles->findIncludingInactive($initial->articleId, forUpdate: true)
                ?? throw new LoanViolation('NOT_FOUND', 'El artículo solicitado no existe.');
            $item = $this->loans->findItem($loanId, $itemId, forUpdate: true)
                ?? throw new LoanViolation('NOT_FOUND', 'La línea solicitada no pertenece al préstamo.');
            $item->returnAt($this->clock->now());
            $article->restock();
            $this->loans->saveReturn($item);
            $this->articles->save($article);

            return $item->publicData();
        });
    }
}
