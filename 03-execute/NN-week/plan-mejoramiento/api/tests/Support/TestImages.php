<?php

namespace Tests\Support;

final class TestImages
{
    public static function png(): string
    {
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.hash('crc32b', $type.$data, true);

        return "\x89PNG\r\n\x1a\n".$chunk('IHDR', pack('NNCCCCC', 1, 1, 8, 6, 0, 0, 0))
            .$chunk('IDAT', gzcompress("\0\0\0\0\0")).$chunk('IEND', '');
    }

    public static function jpg(): string
    {
        return base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EF//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EF//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EF//2Q==', true);
    }

    public static function pngOfSize(int $size): string
    {
        $png = self::png();
        $data = 'padding'."\0".str_repeat('x', $size - strlen($png) - 12 - 8);
        $chunk = pack('N', strlen($data)).'tEXt'.$data.hash('crc32b', 'tEXt'.$data, true);

        return substr($png, 0, -12).$chunk.substr($png, -12);
    }
}
