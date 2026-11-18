<?php

namespace App\Infrastructure\Storage;

use App\Application\Exceptions\CoverFailure;
use App\Application\Ports\ImageInspector;
use App\Domain\ValueObjects\CoverImage;
use finfo;

final class NativeImageInspector implements ImageInspector
{
    public function inspect(string $contents): CoverImage
    {
        if ($contents === '' || strlen($contents) > CoverImage::MAX_BYTES) {
            throw new CoverFailure('VALIDATION_ERROR', 422, 'La imagen debe ser JPG o PNG y no superar 2 MB.');
        }
        $size = @getimagesizefromstring($contents);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($contents);
        if ($size === false || ! in_array($size[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)
            || ! in_array($mime, ['image/jpeg', 'image/png'], true) || ($size['mime'] ?? null) !== $mime
            || ($mime === 'image/png' && ! $this->completePng($contents))
            || ($mime === 'image/jpeg' && (! str_starts_with($contents, "\xff\xd8") || ! str_ends_with($contents, "\xff\xd9")))) {
            throw new CoverFailure('VALIDATION_ERROR', 422, 'El contenido del archivo no es una imagen JPG o PNG válida.');
        }

        return new CoverImage($contents, $mime);
    }

    private function completePng(string $contents): bool
    {
        if (! str_starts_with($contents, "\x89PNG\r\n\x1a\n")) {
            return false;
        }
        $offset = 8;
        $hasData = false;
        $size = strlen($contents);
        while ($offset + 12 <= $size) {
            $length = unpack('N', substr($contents, $offset, 4))[1];
            if ($length > $size - $offset - 12) {
                return false;
            }
            $type = substr($contents, $offset + 4, 4);
            $data = substr($contents, $offset + 8, $length);
            $crc = substr($contents, $offset + 8 + $length, 4);
            if (! preg_match('/\A[A-Za-z]{4}\z/', $type) || hash('crc32b', $type.$data, true) !== $crc) {
                return false;
            }
            if ($offset === 8 && ($type !== 'IHDR' || $length !== 13)) {
                return false;
            }
            if ($type === 'IDAT') {
                $hasData = true;
            }
            $offset += $length + 12;
            if ($type === 'IEND') {
                return $hasData && $length === 0 && $offset === $size;
            }
        }

        return false;
    }
}
