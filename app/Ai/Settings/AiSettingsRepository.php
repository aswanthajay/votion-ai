<?php

namespace App\Ai\Settings;

use App\Models\AiProviderCredential;
use App\Models\AiWorkspaceSetting;
use App\Models\User;
use App\Models\UserAiCredential;
use Illuminate\Support\Facades\Schema;

/**
 * Workspace AI settings. DB values override env/config when present.
 */
final class AiSettingsRepository
{
    private bool $tablesReady;

    private bool $userTablesReady;

    public function __construct()
    {
        $this->tablesReady = Schema::hasTable('ai_workspace_settings')
            && Schema::hasTable('ai_provider_credentials');
        $this->userTablesReady = Schema::hasTable('user_ai_credentials');
    }

    public function defaultModelId(): string
    {
        if ($this->tablesReady) {
            $stored = AiWorkspaceSetting::current()->default_model;
            if (is_string($stored) && $stored !== '') {
                return $stored;
            }
        }

        return (string) config('ai.default_model', '');
    }

    public function setDefaultModelId(string $modelId): void
    {
        AiWorkspaceSetting::current()->update(['default_model' => $modelId]);
    }

    public function apiKey(string $provider, ?User $user = null): string
    {
        if ($user !== null && $this->userTablesReady) {
            $userRow = UserAiCredential::query()
                ->where('user_id', $user->getKey())
                ->where('provider', $provider)
                ->first();

            if ($userRow) {
                if (! $userRow->enabled) {
                    // Disabled by user: fall back to workspace key.
                } elseif (filled($userRow->api_key)) {
                    return (string) $userRow->api_key;
                }
            }
        }

        if ($this->tablesReady) {
            $row = AiProviderCredential::query()->where('provider', $provider)->first();
            if ($row) {
                if (! $row->enabled) {
                    return '';
                }
                if (filled($row->api_key)) {
                    return (string) $row->api_key;
                }
            }
        }

        return $this->envApiKey($provider);
    }

    public function applicationId(string $provider, ?User $user = null): string
    {
        if ($user !== null && $this->userTablesReady) {
            $userRow = UserAiCredential::query()
                ->where('user_id', $user->getKey())
                ->where('provider', $provider)
                ->first();

            if ($userRow && $userRow->enabled && filled($userRow->application_id)) {
                return (string) $userRow->application_id;
            }
        }

        if ($this->tablesReady) {
            $row = AiProviderCredential::query()->where('provider', $provider)->first();
            if ($row && filled($row->application_id)) {
                return (string) $row->application_id;
            }
        }

        return trim((string) config("ai.providers.{$provider}.account_id", ''));
    }

    public function isByok(string $provider, ?User $user = null): bool
    {
        if ($user === null || ! $this->userTablesReady) {
            return false;
        }

        $userRow = UserAiCredential::query()
            ->where('user_id', $user->getKey())
            ->where('provider', $provider)
            ->first();

        return (bool) ($userRow && $userRow->enabled && filled($userRow->api_key));
    }

    public function hasStoredKey(string $provider): bool
    {
        if (! $this->tablesReady) {
            return false;
        }

        $row = AiProviderCredential::query()->where('provider', $provider)->first();

        return (bool) ($row && filled($row->api_key));
    }

    public function hasUnreadableStoredKey(string $provider): bool
    {
        if (! $this->tablesReady) {
            return false;
        }

        $row = AiProviderCredential::query()->where('provider', $provider)->first();

        return $row?->cipherIsUnreadable('api_key') ?? false;
    }

    public function isEnabled(string $provider): bool
    {
        if (! $this->tablesReady) {
            return true;
        }

        $row = AiProviderCredential::query()->where('provider', $provider)->first();

        return $row ? (bool) $row->enabled : true;
    }

    public function keySource(string $provider): string
    {
        if (! $this->isEnabled($provider)) {
            return 'missing';
        }

        if ($provider === 'webllm') {
            return 'browser';
        }

        if ($this->hasStoredKey($provider)) {
            return 'workspace';
        }

        if ($this->envApiKey($provider) !== '') {
            return 'env';
        }

        return 'missing';
    }

    /**
     * Env / config fallback when no enabled workspace key is stored.
     */
    public function envApiKey(string $provider): string
    {
        return trim((string) config("ai.providers.{$provider}.api_key", ''));
    }

    public function keySourceFor(string $provider, ?User $user = null): string
    {
        if ($this->isByok($provider, $user)) {
            return 'byok';
        }

        return $this->keySource($provider);
    }

    public function userCredential(?User $user, string $provider): ?UserAiCredential
    {
        if ($user === null || ! $this->userTablesReady) {
            return null;
        }

        return UserAiCredential::query()
            ->where('user_id', $user->getKey())
            ->where('provider', $provider)
            ->first();
    }

    public function userMaskedKey(?User $user, string $provider): ?string
    {
        $cred = $this->userCredential($user, $provider);
        if (! $cred || blank($cred->api_key)) {
            return null;
        }

        $tail = substr((string) $cred->api_key, -4);

        return '••••••••'.$tail;
    }

    /**
     * @param  array{api_key?: string|null, application_id?: string|null, enabled?: bool, clear?: bool}  $data
     */
    public function saveUserCredential(User $user, string $provider, array $data): UserAiCredential
    {
        $row = UserAiCredential::query()->firstOrNew([
            'user_id' => $user->getKey(),
            'provider' => $provider,
        ]);

        if (array_key_exists('enabled', $data)) {
            $row->enabled = (bool) $data['enabled'];
        }

        if (! empty($data['clear_application_id'])) {
            $row->application_id = null;
        } elseif (array_key_exists('application_id', $data) && filled($data['application_id'])) {
            $row->application_id = trim((string) $data['application_id']);
        }

        if (! empty($data['clear'])) {
            $row->api_key = null;
        } elseif (array_key_exists('api_key', $data) && filled($data['api_key'])) {
            $row->api_key = trim((string) $data['api_key']);
        }

        $row->save();

        return $row;
    }

    public function deleteUserCredential(User $user, string $provider): void
    {
        if (! $this->userTablesReady) {
            return;
        }

        UserAiCredential::query()
            ->where('user_id', $user->getKey())
            ->where('provider', $provider)
            ->delete();
    }

    public function maskedKey(string $provider): ?string
    {
        $key = $this->apiKey($provider);
        if ($key === '') {
            return null;
        }

        $tail = substr($key, -4);

        return '••••••••'.$tail;
    }

    /**
     * @param  array<string, array{api_key?: string|null, enabled?: bool, clear?: bool}>  $rows
     */
    public function saveProviderCredentials(array $rows): void
    {
        foreach ($rows as $provider => $data) {
            $row = AiProviderCredential::query()->firstOrNew(['provider' => $provider]);
            $row->enabled = (bool) ($data['enabled'] ?? $row->enabled ?? true);

            if (! empty($data['clear_application_id'])) {
                $row->application_id = null;
            } elseif (array_key_exists('application_id', $data) && filled($data['application_id'])) {
                $row->application_id = trim((string) $data['application_id']);
            }

            if (! empty($data['clear'])) {
                $row->api_key = null;
            } elseif (filled($data['api_key'] ?? null)) {
                $row->api_key = trim((string) $data['api_key']);
            }

            $row->save();
        }
    }

    /**
     * Provider configs with workspace keys merged over env defaults.
     *
     * @return array<string, array<string, mixed>>
     */
    public function resolvedProviders(): array
    {
        /** @var array<string, array<string, mixed>> $providers */
        $providers = config('ai.providers', []);

        foreach ($providers as $name => $config) {
            $key = $this->apiKey((string) $name);
            $providers[$name]['api_key'] = $this->isEnabled((string) $name) ? $key : '';
        }

        return $providers;
    }
}
