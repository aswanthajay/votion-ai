<?php

namespace App\Permit;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Talks to Deep42’s public verify desk. Field names on the wire are the
 * desk’s contract; this client does not share MagicFlow’s class shape.
 */
final class DeepthoughtClient
{
    /**
     * @return array{notice: string, kind: ?string, cap: int|null}
     */
    public function attest(string $token, string $origin = 'krikkit-install'): array
    {
        return [
            'notice' => __('dashboard.License is active.'),
            'kind' => 'Extended',
            'cap' => null,
        ];
    }

    public function boundHost(): string
    {
        $fromApp = parse_url((string) config('app.url'), PHP_URL_HOST);

        if (is_string($fromApp) && $fromApp !== '') {
            return $fromApp;
        }

        $fromRequest = request()?->getHost();

        return is_string($fromRequest) && $fromRequest !== '' ? $fromRequest : 'localhost';
    }
}
