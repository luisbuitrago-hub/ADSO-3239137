<?php

namespace Tests\Support;

use App\Application\Ports\ArticleRepository;
use App\Application\Ports\CoverStorage;
use App\Application\Services\LoginService;
use App\Domain\ValueObjects\CoverImage;
use App\Models\User;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;

trait CoverScenarios
{
    protected string $coverRoot = '';

    protected array $coverArticle;

    protected User $coverActor;

    protected function initializeCovers(): void
    {
        $this->coverRoot = sys_get_temp_dir().'/kitchenware-covers-'.bin2hex(random_bytes(16));
        $config = ['driver' => 'local', 'root' => $this->coverRoot, 'visibility' => 'private', 'serve' => false, 'throw' => true];
        config(['filesystems.disks.covers' => $config, 'jwt.secret' => bin2hex(random_bytes(32)), 'jwt.algo' => 'HS256', 'hashing.bcrypt.rounds' => 4]);
        Storage::set('covers', Storage::build($config));
        $this->coverActor = User::factory()->create(['username' => 'cover-admin', 'role' => 'admin', 'password_hash' => Hash::driver('bcrypt')->make('Cover fixture password!')]);
        $this->withToken(app(LoginService::class)->login($this->coverActor->username, 'Cover fixture password!')['access_token']);
        $this->coverArticle = ['id' => (string) Str::uuid(), 'name' => 'Olla', 'description' => 'Menaje', 'reference' => 'COVER-1',
            'category_id' => '11111111-1111-4111-8111-111111111111', 'total_units' => 2, 'available_units' => 2];
        DB::table('article')->insert($this->coverArticle);
    }

    protected function cleanupCovers(): void
    {
        if (str_starts_with($this->coverRoot, sys_get_temp_dir().'/kitchenware-covers-')) {
            (new Filesystem)->deleteDirectory($this->coverRoot);
        }
    }

    protected function coverPath(?string $id = null): string
    {
        return '/api/v1/articles/'.($id ?? $this->coverArticle['id']).'/cover';
    }

    protected function uploadCover(?string $contents = null, string $name = 'upload.png', ?string $id = null)
    {
        $file = UploadedFile::fake()->createWithContent($name, $contents ?? TestImages::png());

        return $this->call('PUT', $this->coverPath($id), [], [], ['file' => $file], $this->transformHeadersToServerVars(['Accept' => 'application/json']));
    }

    public static function imageFormats(): array
    {
        return [['png'], ['jpg']];
    }

    #[DataProvider('imageFormats')]
    public function test_content_validated_image_uses_private_opaque_key_and_operator_can_download(string $format): void
    {
        $bytes = $format === 'png' ? TestImages::png() : TestImages::jpg();
        $response = $this->uploadCover($bytes, '../../untrusted.php')->assertOk();
        $key = $response->json('cover_key');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}\.'.$format.'$/D', $key);
        $this->assertSame($bytes, Storage::disk('covers')->get($key));
        $this->assertSame(0600, fileperms(Storage::disk('covers')->path($key)) & 0777);
        $this->coverActor->update(['role' => 'operator']);
        $this->get($this->coverPath())->assertOk()->assertContent($bytes)
            ->assertHeader('Content-Type', $format === 'png' ? 'image/png' : 'image/jpeg')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame(2, DB::table('article')->value('available_units'));
    }

    public function test_replacement_and_deletion_remove_old_files_only_after_database_update(): void
    {
        $one = $this->uploadCover()->assertOk()->json('cover_key');
        $two = $this->uploadCover(TestImages::jpg(), 'new.jpg')->assertOk()->json('cover_key');
        $this->assertNotSame($one, $two);
        Storage::disk('covers')->assertMissing($one)->assertExists($two);
        $this->assertSame($two, DB::table('article')->value('cover_key'));
        $this->deleteJson($this->coverPath())->assertNoContent();
        Storage::disk('covers')->assertMissing($two);
        $this->assertNull(DB::table('article')->value('cover_key'));
        $this->getJson($this->coverPath())->assertNotFound();
        $this->deleteJson($this->coverPath())->assertNoContent();
    }

    public function test_invalid_content_and_oversized_files_are_rejected_without_files_or_references(): void
    {
        foreach (['<?php echo "invalid";', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', '%PDF-1.7',
            base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='), 'not an image', '',
            substr(TestImages::png(), 0, 33), substr(TestImages::jpg(), 0, -2),
            substr_replace(TestImages::png(), 'X', 29, 1), str_repeat('x', CoverImage::MAX_BYTES + 1)] as $bytes) {
            $this->uploadCover($bytes)->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
        }
        $this->putJson($this->coverPath(), [])->assertUnprocessable();
        $this->assertSame([], Storage::disk('covers')->allFiles());
        $this->assertNull(DB::table('article')->value('cover_key'));
    }

    public function test_two_mebibytes_boundary_is_accepted_and_one_more_byte_is_rejected(): void
    {
        $exact = TestImages::pngOfSize(CoverImage::MAX_BYTES);
        $this->assertSame(CoverImage::MAX_BYTES, strlen($exact));
        $key = $this->uploadCover($exact)->assertOk()->json('cover_key');
        $this->uploadCover($exact.'x')->assertUnprocessable();
        $this->assertSame($key, DB::table('article')->value('cover_key'));
        $this->assertSame(CoverImage::MAX_BYTES, Storage::disk('covers')->size($key));
    }

    public function test_authentication_roles_and_resource_errors_precede_protected_operations(): void
    {
        $key = $this->uploadCover()->assertOk()->json('cover_key');
        $this->coverActor->update(['role' => 'operator']);
        $this->uploadCover()->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
        $this->deleteJson($this->coverPath())->assertForbidden();
        $this->get($this->coverPath())->assertOk();
        $this->coverActor->update(['role' => 'admin']);
        $missing = (string) Str::uuid();
        $this->uploadCover(id: $missing)->assertNotFound();
        $this->getJson($this->coverPath($missing))->assertNotFound();
        $this->deleteJson($this->coverPath($missing))->assertNotFound();
        DB::table('article')->where('id', $this->coverArticle['id'])->update(['deleted_at' => '2026-11-16 12:00:00']);
        $this->uploadCover()->assertNotFound();
        $this->getJson($this->coverPath())->assertNotFound();
        $this->deleteJson($this->coverPath())->assertNotFound();
        Storage::disk('covers')->assertExists($key);
        $this->flushHeaders();
        $this->getJson($this->coverPath())->assertUnauthorized();
        $this->deleteJson($this->coverPath())->assertUnauthorized();
        $this->uploadCover()->assertUnauthorized();
    }

    public function test_missing_corrupt_and_traversal_keys_never_expose_external_files(): void
    {
        $this->getJson($this->coverPath())->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
        foreach (['../outside.png', '/etc/passwd', '..\\outside.png', str_repeat('a', 64).'.png'] as $key) {
            DB::table('article')->where('id', $this->coverArticle['id'])->update(['cover_key' => $key]);
            $this->getJson($this->coverPath())->assertNotFound();
        }
        $key = str_repeat('b', 64).'.png';
        Storage::disk('covers')->put($key, '<?php not an image');
        DB::table('article')->where('id', $this->coverArticle['id'])->update(['cover_key' => $key]);
        $this->getJson($this->coverPath())->assertNotFound();
        $this->deleteJson($this->coverPath())->assertNoContent();
    }

    public function test_symlinks_are_not_followed_or_used_to_delete_external_files(): void
    {
        $outside = $this->coverRoot.'-outside.png';
        file_put_contents($outside, TestImages::png());
        $key = str_repeat('c', 64).'.png';
        $link = Storage::disk('covers')->path($key);
        symlink($outside, $link);
        try {
            DB::table('article')->where('id', $this->coverArticle['id'])->update(['cover_key' => $key]);
            $this->getJson($this->coverPath())->assertNotFound();
            $this->deleteJson($this->coverPath())->assertNoContent();
            $this->assertFileExists($outside);
            $this->assertSame(TestImages::png(), file_get_contents($outside));
        } finally {
            if (is_link($link)) {
                unlink($link);
            } unlink($outside);
        }
    }

    public function test_database_failure_compensates_new_file_and_preserves_previous_image(): void
    {
        $old = $this->uploadCover()->assertOk()->json('cover_key');
        $real = app(ArticleRepository::class);
        $repository = $this->createMock(ArticleRepository::class);
        $repository->method('findActive')->willReturn($real->findActive($this->coverArticle['id']));
        $repository->method('setCoverKey')->willThrowException(new \RuntimeException('Fallo SQL simulado.'));
        $this->app->instance(ArticleRepository::class, $repository);
        Log::spy();
        $this->uploadCover()->assertStatus(500)->assertExactJson(['code' => 'INTERNAL_ERROR', 'message' => 'No fue posible completar la operación.', 'details' => []]);
        $this->assertSame($old, DB::table('article')->value('cover_key'));
        $this->assertSame([$old], Storage::disk('covers')->allFiles());
        $this->deleteJson($this->coverPath())->assertStatus(500);
        Storage::disk('covers')->assertExists($old);
    }

    public function test_outer_transaction_rollback_restores_reference_and_removes_new_file(): void
    {
        $old = $this->uploadCover()->assertOk()->json('cover_key');
        DB::beginTransaction();
        try {
            $new = $this->uploadCover()->assertOk()->json('cover_key');
            Storage::disk('covers')->assertExists($old)->assertExists($new);
        } finally {
            DB::rollBack();
        }
        $this->assertSame($old, DB::table('article')->value('cover_key'));
        Storage::disk('covers')->assertExists($old)->assertMissing($new);
    }

    public function test_old_file_is_retained_until_actual_outer_commit(): void
    {
        $old = $this->uploadCover()->assertOk()->json('cover_key');
        DB::beginTransaction();
        try {
            $this->deleteJson($this->coverPath())->assertNoContent();
            $this->assertNull(DB::table('article')->value('cover_key'));
            Storage::disk('covers')->assertExists($old);
            DB::commit();
        } finally {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
        }
        Storage::disk('covers')->assertMissing($old);
    }

    public function test_storage_failure_keeps_reference_and_does_not_leak_paths(): void
    {
        $old = $this->uploadCover()->assertOk()->json('cover_key');
        $storage = $this->createMock(CoverStorage::class);
        $storage->method('put')->willThrowException(new \RuntimeException($this->coverRoot));
        $this->app->instance(CoverStorage::class, $storage);
        Log::spy();
        $this->uploadCover()->assertStatus(500)->assertExactJson(['code' => 'INTERNAL_ERROR', 'message' => 'No fue posible completar la operación.', 'details' => []]);
        $this->assertSame($old, DB::table('article')->value('cover_key'));
        Storage::disk('covers')->assertExists($old);
    }

    public function test_cleanup_failure_after_commit_keeps_new_reference_and_new_image_readable(): void
    {
        $old = $this->uploadCover()->assertOk()->json('cover_key');
        $real = app(CoverStorage::class);
        $storage = $this->createMock(CoverStorage::class);
        $storage->method('put')->willReturnCallback(fn (CoverImage $image) => $real->put($image));
        $storage->method('read')->willReturnCallback(fn (string $key) => $real->read($key));
        $atDeletion = [];
        $storage->method('delete')->willReturnCallback(function (string $key) use (&$atDeletion): void {
            $atDeletion = ['transaction_level' => DB::transactionLevel(), 'reference' => DB::table('article')->value('cover_key'), 'key' => $key];
            throw new \RuntimeException('Fallo simulado al retirar archivo anterior.');
        });
        $this->app->instance(CoverStorage::class, $storage);
        Log::spy();
        $this->uploadCover()->assertStatus(500)->assertJsonPath('code', 'INTERNAL_ERROR');
        $new = DB::table('article')->value('cover_key');
        $this->assertNotSame($old, $new);
        $this->assertSame(['transaction_level' => 0, 'reference' => $new, 'key' => $old], $atDeletion);
        Storage::disk('covers')->assertExists($old)->assertExists($new);
        $this->get($this->coverPath())->assertOk()->assertContent(TestImages::png());
    }
}
