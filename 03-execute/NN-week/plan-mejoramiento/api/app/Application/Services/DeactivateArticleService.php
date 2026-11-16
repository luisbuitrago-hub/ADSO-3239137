<?php

namespace App\Application\Services;

use App\Application\Exceptions\CatalogFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\Clock;
use App\Application\Ports\TransactionManager;

final readonly class DeactivateArticleService
{
    public function __construct(private ArticleRepository $articles, private TransactionManager $transactions, private Clock $clock) {}

    public function deactivate(string $actorRole, string $id): void
    {
        if ($actorRole !== 'admin') {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }
        $this->transactions->run(function () use ($id): void {
            $article = $this->articles->findActive($id, forUpdate: true)
                ?? throw new CatalogFailure('NOT_FOUND', 404, 'El artículo solicitado no existe.');
            $article->deactivate($this->clock->now(), $this->articles->hasOpenLoans($id));
            $this->articles->save($article);
        });
    }
}
