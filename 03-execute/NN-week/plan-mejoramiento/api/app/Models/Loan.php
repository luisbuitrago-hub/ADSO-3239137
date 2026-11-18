<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Loan extends Model
{
    protected $table = 'loan';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'neighbor_id',
        'loaned_by_user_id',
        'loaned_at',
    ];

    protected $casts = [
        'loaned_at' => 'immutable_datetime',
    ];

    public function neighbor(): BelongsTo
    {
        return $this->belongsTo(Neighbor::class, 'neighbor_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'loaned_by_user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(LoanItem::class, 'loan_id');
    }
}
