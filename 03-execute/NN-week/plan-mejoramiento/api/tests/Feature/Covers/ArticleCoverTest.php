<?php

namespace Tests\Feature\Covers;

use Tests\Support\CatalogTestCase;
use Tests\Support\CoverScenarios;

class ArticleCoverTest extends CatalogTestCase
{
    use CoverScenarios;

    protected function setUp(): void
    {
        parent::setUp();
        $this->initializeCovers();
    }

    protected function tearDown(): void
    {
        try {
            parent::tearDown();
        } finally {
            $this->cleanupCovers();
        }
    }
}
