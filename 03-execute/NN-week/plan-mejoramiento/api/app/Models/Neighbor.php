<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Neighbor extends Model
{
    protected $table = 'neighbor';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'full_name',
        'document_number',
    ];

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class, 'neighbor_id');
    }
}
