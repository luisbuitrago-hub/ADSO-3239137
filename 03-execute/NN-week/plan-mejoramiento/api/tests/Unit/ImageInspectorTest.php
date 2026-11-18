<?php

namespace Tests\Unit;

use App\Application\Exceptions\CoverFailure;
use App\Infrastructure\Storage\NativeImageInspector;
use PHPUnit\Framework\TestCase;
use Tests\Support\TestImages;

class ImageInspectorTest extends TestCase
{
    public function test_content_inspection_identifies_formats_independently_of_names_and_client_mime(): void
    {
        $inspector = new NativeImageInspector;
        $this->assertSame('png', $inspector->inspect(TestImages::png())->extension());
        $this->assertSame('jpg', $inspector->inspect(TestImages::jpg())->extension());
    }

    public function test_truncated_and_corrupt_container_is_not_accepted_as_a_valid_image(): void
    {
        $this->expectException(CoverFailure::class);
        (new NativeImageInspector)->inspect(substr(TestImages::png(), 0, 33));
    }
}
