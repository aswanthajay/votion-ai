<?php

namespace App\Ai\Drivers;

use App\Ai\Contracts\StreamableChatDriver;
use App\Ai\Data\ChatMessage;
use App\Ai\Data\ChatRequest;
use App\Ai\Data\ChatResponse;
use App\Ai\Data\ChatRole;
use App\Ai\Data\ToolCall;
use App\Ai\Exceptions\ProviderException;
use App\Ai\Support\OpenAiStreamParser;
use App\Ai\Support\PromptCache;
use App\Ai\Support\ProviderHttp;
use App\Ai\Support\ProviderSse;
use App\Ai\Support\ProviderToolSupport;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;

/**
 * Cloudflare Workers AI driver using Cloudflare's OpenAI-compatible endpoint:
 * https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
 */
final class CloudflareDriver implements StreamableChatDriver
{
    private string $baseUrl;

    /**
     * @param  array<string, mixed>  $config
     */
    public function __construct(
        private readonly string $provider,
        private readonly array $config,
    ) {
        $baseUrl = trim((string) ($this->config['base_url'] ?? ''));
        $accountId = trim((string) ($this->config['account_id'] ?? ''));

        if ($baseUrl === '' && $accountId !== '') {
            $baseUrl = "https://api.cloudflare.com/client/v4/accounts/{$accountId}/ai/v1";
        }

        $this->baseUrl = rtrim($baseUrl, '/');
    }

    public function complete(ChatRequest $request): ChatResponse
    {
        $key = $this->resolveApiKey();
        $this->ensureBaseUrl();

        $payload = $this->payload($request);

        try {
            $response = $this->client($key)->post('/chat/completions', $payload);
        } catch (ConnectionException $e) {
            throw ProviderException::unreachable($this->provider, $e->getMessage());
        }

        if ($response->failed()) {
            throw ProviderException::http($this->provider, $response->status(), $response->body());
        }

        $data = $response->json();
        $message = data_get($data, 'choices.0.message', []);
        $content = (string) data_get($message, 'content', '');
        $toolCalls = [];

        foreach (data_get($message, 'tool_calls', []) ?: [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            $toolCalls[] = ToolCall::fromArray([
                'id' => (string) ($row['id'] ?? ''),
                'name' => (string) data_get($row, 'function.name', ''),
                'arguments' => data_get($row, 'function.arguments', []),
            ]);
        }

        return new ChatResponse(
            content: $content,
            modelId: '',
            provider: $this->provider,
            apiModel: (string) data_get($data, 'model', $request->apiModel),
            meta: [
                'usage' => data_get($data, 'usage'),
                'id' => data_get($data, 'id'),
                'finish_reason' => data_get($data, 'choices.0.finish_reason'),
            ],
            toolCalls: $toolCalls,
        );
    }

    public function stream(ChatRequest $request, callable $onEvent): ChatResponse
    {
        $key = $this->resolveApiKey();
        $this->ensureBaseUrl();

        $payload = $this->payload($request);
        $payload['stream'] = true;

        try {
            $response = $this->streamClient($key)->post('/chat/completions', $payload);
        } catch (ConnectionException $e) {
            throw ProviderException::unreachable($this->provider, $e->getMessage());
        }

        $parser = new OpenAiStreamParser;
        ProviderSse::consume($this->provider, $response, function (array $frame) use ($parser, $onEvent): void {
            if ($frame['data'] === '[DONE]') {
                return;
            }
            $chunk = json_decode($frame['data'], true);
            if (! is_array($chunk)) {
                return;
            }
            $parser->ingest($chunk, $onEvent);
        });
        $parser->finish($onEvent);

        $meta = $parser->meta($request->apiModel);

        return new ChatResponse(
            content: $parser->content(),
            modelId: '',
            provider: $this->provider,
            apiModel: (string) ($meta['model'] ?? $request->apiModel),
            meta: [
                'usage' => $meta['usage'],
                'id' => $meta['id'],
                'finish_reason' => $meta['finish_reason'],
            ],
            toolCalls: $parser->toolCalls(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(ChatRequest $request): array
    {
        $payload = [
            'model' => $request->apiModel,
            'messages' => $this->formatMessages($request),
        ];

        foreach (['temperature', 'max_tokens', 'top_p'] as $option) {
            if (array_key_exists($option, $request->options)) {
                $payload[$option] = $request->options[$option];
            }
        }

        if (isset($payload['max_tokens'])) {
            $payload['max_tokens'] = max(256, min(4096, (int) $payload['max_tokens']));
        }

        if ($request->wantsTools()) {
            $payload['tools'] = $request->tools;
            $forced = ProviderToolSupport::forcedToolName($request->toolChoice);
            if ($forced !== null) {
                $payload['tool_choice'] = [
                    'type' => 'function',
                    'function' => ['name' => $forced],
                ];
            } else {
                $payload['tool_choice'] = 'auto';
            }
        }

        return $payload;
    }

    /**
     * @return list<array{role: string, content: string}>
     */
    private function formatMessages(ChatRequest $request): array
    {
        $messages = [];

        $system = PromptCache::concatenate(
            $request->system,
            $request->systemRules,
            $request->systemBaseline,
        );
        if ($system !== '') {
            $messages[] = ['role' => ChatRole::System->value, 'content' => $system];
        }

        $dynamic = $request->resolvedDynamic();
        if ($dynamic !== '') {
            $messages[] = [
                'role' => ChatRole::User->value,
                'content' => "[Votion AI turn context — not visible chat]\n{$dynamic}",
            ];
            $messages[] = [
                'role' => ChatRole::Assistant->value,
                'content' => 'Acknowledged turn context.',
            ];
        }

        /** @var ChatMessage $message */
        foreach ($request->messages as $message) {
            if ($message->role === ChatRole::System) {
                continue;
            }

            $messages[] = $message->toArray();
        }

        return $messages;
    }

    private function resolveApiKey(): string
    {
        $key = trim((string) ($this->config['api_key'] ?? ''));
        if ($key === '') {
            throw ProviderException::missingKey($this->provider);
        }

        return $key;
    }

    private function ensureBaseUrl(): void
    {
        if ($this->baseUrl === '') {
            throw ProviderException::missingAccountId($this->provider);
        }
    }

    private function client(string $apiKey): PendingRequest
    {
        return ProviderHttp::make($this->config)
            ->baseUrl($this->baseUrl)
            ->withToken($apiKey);
    }

    private function streamClient(string $apiKey): PendingRequest
    {
        return ProviderHttp::streaming($this->config)
            ->baseUrl($this->baseUrl)
            ->withToken($apiKey);
    }
}