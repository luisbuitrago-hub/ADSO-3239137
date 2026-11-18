<?php

namespace Tests\Integration;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\ConcurrentPostgresTestCase;
use Tests\Support\CoverScenarios;
use Tests\Support\TestImages;

class CoverStorageIntegrationTest extends ConcurrentPostgresTestCase
{
    use CoverScenarios;

    public function test_image_changes_do_not_touch_inventory_or_loan_snapshots(): void
    {
        $neighbor = (string) Str::uuid();
        $loan = (string) Str::uuid();
        DB::table('neighbor')->insert(['id' => $neighbor, 'full_name' => 'Vecino', 'document_number' => '123']);
        DB::table('loan')->insert(['id' => $loan, 'neighbor_id' => $neighbor, 'loaned_by_user_id' => $this->coverActor->id, 'loaned_at' => '2026-11-15T12:00:00Z']);
        DB::table('loan_item')->insert(['id' => (string) Str::uuid(), 'loan_id' => $loan, 'article_id' => $this->coverArticle['id'],
            'article_name' => 'Nombre historico', 'article_reference' => 'COVER-1', 'category_name' => 'ollas', 'due_at' => '2026-11-18T12:00:00Z']);
        DB::table('article')->where('id', $this->coverArticle['id'])->update(['available_units' => 1]);
        $before = DB::table('loan_item')->get()->toJson();
        $this->uploadCover()->assertOk();
        $this->deleteJson($this->coverPath())->assertNoContent();
        $this->assertSame($before, DB::table('loan_item')->get()->toJson());
        $this->assertSame(1, DB::table('article')->value('available_units'));
    }

    public function test_real_multipart_put_and_binary_get_over_local_http_on_the_verified_runtime(): void
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0', $errorCode, $errorMessage);
        $this->assertIsResource($socket);
        $address = stream_socket_get_name($socket, false);
        fclose($socket);
        $port = (int) substr(strrchr($address, ':'), 1);
        $environment = array_merge(getenv(), ['APP_ENV' => 'testing', 'WIRE_DATABASE' => config('database.connections.concurrent.database'),
            'WIRE_SECRET' => config('jwt.secret'), 'WIRE_COVERS_ROOT' => $this->coverRoot]);
        $server = proc_open([PHP_BINARY, '-S', '127.0.0.1:'.$port, base_path('tests/Support/cover-http-router.php')],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, base_path(), $environment);
        $temporary = tempnam(sys_get_temp_dir(), 'kitchenware-upload-');
        try {
            $deadline = microtime(true) + 5;
            do {
                $probe = @fsockopen('127.0.0.1', $port, $probeError, $probeMessage, 0.1);
                if (is_resource($probe)) {
                    fclose($probe);
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            file_put_contents($temporary, TestImages::png());
            $curl = curl_init('http://127.0.0.1:'.$port.$this->coverPath());
            curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_POSTFIELDS => ['file' => new \CURLFile($temporary, 'image/png', '../../untrusted.php')],
                CURLOPT_HTTPHEADER => ['Accept: application/json', 'Authorization: '.$this->defaultHeaders['Authorization']], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5]);
            $contents = curl_exec($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            curl_close($curl);
            $this->assertSame(200, $status, 'La carga debe funcionar con PUT multipart real, sin simular el objeto UploadedFile.');
            $key = json_decode($contents, true)['cover_key'];
            $this->assertSame($key, DB::table('article')->value('cover_key'));
            $curl = curl_init('http://127.0.0.1:'.$port.$this->coverPath());
            curl_setopt_array($curl, [CURLOPT_HTTPHEADER => ['Authorization: '.$this->defaultHeaders['Authorization']], CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5]);
            $bytes = curl_exec($curl);
            $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $mime = curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
            curl_close($curl);
            $this->assertSame(200, $status);
            $this->assertSame('image/png', $mime);
            $this->assertSame(TestImages::png(), $bytes);
        } finally {
            if (is_resource($server)) {
                proc_terminate($server);
                foreach ($pipes as $pipe) {
                    fclose($pipe);
                } proc_close($server);
            }
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }

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
