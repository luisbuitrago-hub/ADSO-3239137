<?php

namespace App\Infrastructure\Persistence;

use App\Application\Exceptions\SecurityFailure;
use App\Application\Ports\UserRepository;
use App\Domain\Entities\User;
use App\Domain\ValueObjects\Username;
use App\Models\User as UserModel;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final class EloquentUserRepository implements UserRepository
{
    public function findByUsername(string $username): ?User
    {
        return $this->toDomain(UserModel::where('username', $username)->first());
    }

    public function findAdministrator(): ?User
    {
        return $this->toDomain(UserModel::where('role', 'admin')->first());
    }

    public function create(User $user): void
    {
        try {
            // El savepoint permite traducir duplicados sin abortar una transacción exterior.
            DB::transaction(function () use ($user): void {
                $model = new UserModel;
                $model->id = $user->id;
                $model->username = $user->username->value;
                $model->password_hash = $user->passwordHash();
                $model->role = $user->role;
                $model->save();
            });
        } catch (UniqueConstraintViolationException) {
            throw new SecurityFailure('USERNAME_TAKEN', 409, 'El nombre de usuario ya está registrado.');
        }
    }

    private function toDomain(?UserModel $model): ?User
    {
        return $model === null ? null : new User($model->id, new Username($model->username), $model->role, $model->password_hash);
    }
}
