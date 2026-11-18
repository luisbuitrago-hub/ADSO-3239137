<?php

namespace App\Application\Services;

use App\Application\Exceptions\CoverFailure;
use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\ArticleRepository;
use App\Application\Ports\CoverStorage;
use App\Application\Ports\ImageInspector;
use App\Application\Ports\TransactionManager;
use App\Domain\Entities\Article;
use App\Domain\ValueObjects\CoverImage;
use Throwable;

final readonly class ArticleCoverService
{
    public function __construct(private ArticleRepository $articles, private CoverStorage $storage,
        private ImageInspector $inspector, private TransactionManager $transactions) {}

    public function put(string $actorRole, string $id, string $contents): array
    {
        $this->assertAdmin($actorRole);
        $this->active($id);
        $image = $this->inspector->inspect($contents);
        $key = $this->storage->put($image);
        $committed = false;
        // En una transacción exterior, compensar también su eventual rollback.
        $this->transactions->afterRollback(fn () => $this->storage->delete($key));
        try {
            return $this->transactions->run(function () use ($id, $key, &$committed): array {
                $article = $this->active($id, true);
                $previous = $article->publicData()['cover_key'];
                $this->articles->setCoverKey($id, $key);
                $article->setCoverKey($key);
                $this->transactions->afterCommit(function () use ($previous, &$committed): void {
                    $committed = true;
                    if ($previous !== null) {
                        $this->storage->delete($previous);
                    }
                });

                return $article->publicData();
            });
        } catch (Throwable $exception) {
            // Un fallo al retirar el archivo viejo después del commit no invalida el nuevo.
            if (! $committed) {
                $this->storage->delete($key);
            }
            throw $exception;
        }
    }

    public function delete(string $actorRole, string $id): void
    {
        $this->assertAdmin($actorRole);
        $this->transactions->run(function () use ($id): void {
            $article = $this->active($id, true);
            $previous = $article->publicData()['cover_key'];
            $this->articles->setCoverKey($id, null);
            if ($previous !== null) {
                $this->transactions->afterCommit(fn () => $this->storage->delete($previous));
            }
        });
    }

    public function get(string $id): CoverImage
    {
        return $this->transactions->run(function () use ($id): CoverImage {
            $article = $this->active($id, true);
            $key = $article->publicData()['cover_key'];
            $contents = $key === null ? null : $this->storage->read($key);
            if ($contents === null) {
                throw new CoverFailure('NOT_FOUND', 404, 'El artículo no tiene una imagen disponible.');
            }
            try {
                return $this->inspector->inspect($contents);
            } catch (CoverFailure) {
                throw new CoverFailure('NOT_FOUND', 404, 'El artículo no tiene una imagen disponible.');
            }
        });
    }

    private function active(string $id, bool $lock = false): Article
    {
        return $this->articles->findActive($id, $lock) ?? throw new CoverFailure('NOT_FOUND', 404, 'El artículo solicitado no existe.');
    }

    private function assertAdmin(string $role): void
    {
        if ($role !== 'admin') {
            throw new SecurityFailure('FORBIDDEN_ROLE', 403, 'No tienes permisos para realizar esta operación.');
        }
    }
}
