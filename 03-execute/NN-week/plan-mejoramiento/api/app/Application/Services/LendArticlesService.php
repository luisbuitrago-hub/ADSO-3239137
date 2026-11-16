<?php

namespace App\Application\Services;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\Clock;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\LoanRepository;
use App\Application\Ports\NeighborRepository;
use App\Application\Ports\TransactionManager;
use App\Domain\Entities\Loan;
use App\Domain\Entities\LoanItem;
use App\Domain\Exceptions\LoanViolation;

final readonly class LendArticlesService
{
    public function __construct(private LoanRepository $loans, private NeighborRepository $neighbors,
        private ArticleRepository $articles, private TransactionManager $transactions, private Clock $clock, private IdGenerator $ids) {}

    public function lend(string $actorId, string $actorRole, string $neighborId, array $articleIds): array
    {
        if (! in_array($actorRole, ['admin', 'operator'], true)) {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }
        $articleIds = array_map('strtolower', $articleIds);
        Loan::validateArticleIds($articleIds);

        return $this->transactions->run(function () use ($actorId, $neighborId, $articleIds): array {
            $neighbor = $this->neighbors->lock($neighborId)
                ?? throw new LoanViolation('NOT_FOUND', 'El vecino solicitado no existe.');
            $now = $this->clock->now();
            $state = $this->loans->pendingState($neighborId, $now);
            $neighbor->assertCanBorrow($state['count'], $state['overdue'], count($articleIds));
            $sorted = $articleIds;
            sort($sorted, SORT_STRING);
            $locked = [];
            foreach ($sorted as $id) {
                $locked[$id] = $this->articles->findActive($id, forUpdate: true)
                    ?? throw new LoanViolation('NOT_FOUND', 'El artículo solicitado no existe o está desactivado.');
            }
            // El instante de registro se toma después de adquirir todos los bloqueos.
            $now = $this->clock->now();
            $state = $this->loans->pendingState($neighborId, $now);
            $neighbor->assertCanBorrow($state['count'], $state['overdue'], count($articleIds));
            $loanId = $this->ids->generate();
            $items = [];
            foreach ($articleIds as $id) {
                $article = $locked[$id];
                $article->withdraw();
                $this->articles->save($article);
                $items[] = LoanItem::borrow($this->ids->generate(), $loanId, $article, $now);
            }
            $loan = new Loan($loanId, $neighborId, $actorId, $now, $items);
            $this->loans->create($loan);

            return $loan->publicData($now);
        });
    }
}
