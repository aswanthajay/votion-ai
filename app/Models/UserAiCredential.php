<?php

namespace App\Models;

use App\Models\Concerns\IgnoresUnreadableCipher;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAiCredential extends Model
{
    use IgnoresUnreadableCipher;

    protected $fillable = [
        'user_id',
        'provider',
        'application_id',
        'api_key',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
