<?php

namespace App\Infrastructure\Storage;

use App\Application\Ports\CoverStorage;
use App\Domain\ValueObjects\CoverImage;
use Illuminate\Filesystem\FilesystemAdapter;
use RuntimeException;
use Throwable;

final readonly class LocalCoverStorage implements CoverStorage
{
    public function __construct(private FilesystemAdapter $disk) {}

    public function put(CoverImage $image): string
    {
        do {
            $key = bin2hex(random_bytes(32)).'.'.$image->extension();
        } while ($this->disk->exists($key) || is_link($this->disk->path($key)));
        try {
            if (! $this->disk->put($key, $image->contents, ['visibility' => 'private'])) {
                throw new RuntimeException('No fue posible almacenar la imagen.');
            }
        } catch (Throwable $exception) {
            $this->delete($key);
            throw $exception;
        }

        return $key;
    }

    public function read(string $key): ?string
    {
        if (! $this->safe($key) || is_link($this->disk->path($key)) || ! $this->disk->exists($key)) {
            return null;
        }

        return $this->disk->get($key);
    }

    public function delete(string $key): void
    {
        if (! $this->safe($key) || is_link($this->disk->path($key))) {
            return;
        }
        if (! $this->disk->delete($key)) {
            throw new RuntimeException('No fue posible eliminar la imagen anterior.');
        }
    }

    private function safe(string $key): bool
    {
        return preg_match('/\A[a-f0-9]{64}\.(png|jpg)\z/D', $key) === 1;
    }
}
