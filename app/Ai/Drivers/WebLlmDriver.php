<?php

namespace App\Ai\Drivers;

use App\Ai\Contracts\StreamableChatDriver;
use App\Ai\Data\ChatRequest;
use App\Ai\Data\ChatResponse;

/**
 * Driver for in-browser WebLLM models (e.g. Qwen 2.5 Coder 1.5B via WebGPU).
 *
 * When invoked in a headless server environment (unit tests or direct API calls),
 * it returns informative guidance explaining that WebLLM performs inference client-side
 * inside the user's browser with WebGPU acceleration.
 */
final class WebLlmDriver implements StreamableChatDriver
{
    /**
     * @param  array<string, mixed>  $config
     */
    public function __construct(
        private readonly string $provider,
        private readonly array $config,
    ) {}

    public function complete(ChatRequest $request): ChatResponse
    {
        $model = $request->apiModel ?: 'WebGPU Model';
        $message = "WebLLM ({$model}) executes locally in the web browser using WebGPU acceleration. In-browser client execution is active with 0 credit consumption.";

        return new ChatResponse(
            content: $message,
            modelId: '',
            provider: $this->provider,
            apiModel: $request->apiModel,
            meta: [
                'usage' => ['input_tokens' => 0, 'output_tokens' => 0],
                'is_byok' => true,
                'is_webllm' => true,
                'finish_reason' => 'stop',
            ],
            toolCalls: [],
        );
    }

    public function stream(ChatRequest $request, callable $onEvent): ChatResponse
    {
        $model = $request->apiModel ?: 'WebGPU Model';
        $message = "WebLLM ({$model}) executes locally in the web browser using WebGPU acceleration. In-browser client execution is active with 0 credit consumption.";

        $onEvent([
            'type' => 'text_delta',
            'text' => $message,
        ]);

        return new ChatResponse(
            content: $message,
            modelId: '',
            provider: $this->provider,
            apiModel: $request->apiModel,
            meta: [
                'usage' => ['input_tokens' => 0, 'output_tokens' => 0],
                'is_byok' => true,
                'is_webllm' => true,
                'finish_reason' => 'stop',
            ],
            toolCalls: [],
        );
    }
}
