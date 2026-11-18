<?php

namespace App\Providers;

use App\Application\Ports\ArticleRepository;
use App\Application\Ports\CategoryRepository;
use App\Application\Ports\Clock;
use App\Application\Ports\CoverStorage;
use App\Application\Ports\IdGenerator;
use App\Application\Ports\ImageInspector;
use App\Application\Ports\LoanRepository;
use App\Application\Ports\MostBorrowedReportReader;
use App\Application\Ports\NeighborRepository;
use App\Application\Ports\PasswordHasher;
use App\Application\Ports\TokenIssuer;
use App\Application\Ports\TransactionManager;
use App\Application\Ports\UserRepository;
use App\Infrastructure\Persistence\EloquentArticleRepository;
use App\Infrastructure\Persistence\EloquentCategoryRepository;
use App\Infrastructure\Persistence\EloquentLoanRepository;
use App\Infrastructure\Persistence\EloquentNeighborRepository;
use App\Infrastructure\Persistence\EloquentUserRepository;
use App\Infrastructure\Persistence\LaravelTransactionManager;
use App\Infrastructure\Persistence\PostgresMostBorrowedReportReader;
use App\Infrastructure\Security\BcryptPasswordHasher;
use App\Infrastructure\Security\JwtTokenIssuer;
use App\Infrastructure\Security\SystemClock;
use App\Infrastructure\Security\UuidGenerator;
use App\Infrastructure\Storage\LocalCoverStorage;
use App\Infrastructure\Storage\NativeImageInspector;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(UserRepository::class, EloquentUserRepository::class);
        $this->app->bind(ArticleRepository::class, EloquentArticleRepository::class);
        $this->app->bind(CategoryRepository::class, EloquentCategoryRepository::class);
        $this->app->bind(NeighborRepository::class, EloquentNeighborRepository::class);
        $this->app->bind(LoanRepository::class, EloquentLoanRepository::class);
        $this->app->bind(TransactionManager::class, LaravelTransactionManager::class);
        $this->app->bind(Clock::class, SystemClock::class);
        $this->app->bind(CoverStorage::class, fn () => new LocalCoverStorage(Storage::disk('covers')));
        $this->app->bind(ImageInspector::class, NativeImageInspector::class);
        $this->app->bind(MostBorrowedReportReader::class, PostgresMostBorrowedReportReader::class);
        $this->app->bind(IdGenerator::class, UuidGenerator::class);
        $this->app->bind(TokenIssuer::class, JwtTokenIssuer::class);
        $this->app->bind(PasswordHasher::class, fn ($app) => new BcryptPasswordHasher($app['hash']->driver('bcrypt')));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
