<?php

namespace App\Livewire\Settings\ApiKeys;

use App\Ai\ModelCatalog;
use App\Ai\Settings\AiSettingsRepository;
use App\Livewire\Settings\Traits\HasAccountChrome;
use App\Support\Seo\PageSeo;
use Illuminate\Contracts\View\View;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('components.layouts.app')]
class ApiKeysComponent extends Component
{
    use HasAccountChrome;

    public string $editingProvider = '';

    public string $apiKey = '';

    public string $applicationId = '';

    public bool $enabled = true;

    public string $deleteProvider = '';

    protected function deskSection(): string
    {
        return 'api-keys';
    }

    public function mount(PageSeo $seo): void
    {
        $this->authorizeDesk();
        $this->hydrateDeskSeo($seo);
    }

    public function openEdit(string $provider, AiSettingsRepository $settings): void
    {
        $this->authorizeDesk();

        $user = auth()->user();
        $this->editingProvider = $provider;
        $cred = $settings->userCredential($user, $provider);

        $this->apiKey = '';
        $this->applicationId = $cred ? (string) ($cred->application_id ?? '') : '';
        $this->enabled = $cred ? (bool) $cred->enabled : true;
        $this->resetValidation();

        $this->dispatch('krikkit-modal-open', 'edit-api-key');
        $this->js("window.dispatchEvent(new CustomEvent('krikkit-modal-open', { detail: 'edit-api-key' }))");
    }

    public function save(AiSettingsRepository $settings): void
    {
        $this->authorizeDesk();

        $user = auth()->user();
        $existing = $settings->userCredential($user, $this->editingProvider);
        $hasStoredKey = $existing && filled($existing->api_key);

        $rules = [
            'editingProvider' => ['required', 'string'],
            'enabled' => ['boolean'],
        ];

        if (! $hasStoredKey || filled($this->apiKey)) {
            $rules['apiKey'] = ['required', 'string', 'min:8', 'max:500'];
        }

        if ($this->editingProvider === 'cloudflare') {
            $rules['applicationId'] = ['nullable', 'string', 'max:120'];
        }

        $this->validate($rules);

        $payload = [
            'enabled' => $this->enabled,
        ];

        if (filled($this->apiKey)) {
            $payload['api_key'] = trim($this->apiKey);
        }

        if ($this->editingProvider === 'cloudflare') {
            $payload['application_id'] = trim($this->applicationId);
        }

        $settings->saveUserCredential($user, $this->editingProvider, $payload);

        $this->apiKey = '';
        $this->dispatch('krikkit-modal-close', 'edit-api-key');
        $this->js("window.dispatchEvent(new CustomEvent('krikkit-modal-close', { detail: 'edit-api-key' }))");
        $this->pulseOk(__('settings.API key saved successfully.'));
    }

    public function toggleEnabled(string $provider, AiSettingsRepository $settings): void
    {
        $this->authorizeDesk();

        $user = auth()->user();
        $cred = $settings->userCredential($user, $provider);
        if (! $cred) {
            return;
        }

        $cred->enabled = ! $cred->enabled;
        $cred->save();

        $this->pulseOk($cred->enabled
            ? __('settings.Personal key enabled.')
            : __('settings.Personal key disabled.')
        );
    }

    public function confirmDelete(string $provider): void
    {
        $this->authorizeDesk();
        $this->deleteProvider = $provider;
        $this->dispatch('krikkit-modal-open', 'delete-api-key');
        $this->js("window.dispatchEvent(new CustomEvent('krikkit-modal-open', { detail: 'delete-api-key' }))");
    }

    public function deleteKey(AiSettingsRepository $settings): void
    {
        $this->authorizeDesk();

        if (filled($this->deleteProvider)) {
            $settings->deleteUserCredential(auth()->user(), $this->deleteProvider);
            $this->pulseOk(__('settings.API key removed successfully.'));
        }

        $this->deleteProvider = '';
        $this->dispatch('krikkit-modal-close', 'delete-api-key');
        $this->js("window.dispatchEvent(new CustomEvent('krikkit-modal-close', { detail: 'delete-api-key' }))");
    }

    public function render(AiSettingsRepository $settings, ModelCatalog $catalog): View
    {
        $user = auth()->user();
        $providerConfigs = (array) config('ai.providers', []);
        $allModels = $catalog->all(onlyAvailable: false);

        $portals = [
            'google' => [
                'url' => 'https://aistudio.google.com/app/apikey',
                'badge' => 'Google AI Studio',
                'hint' => 'Gemini 2.5 Flash, Pro & Thinking',
            ],
            'cloudflare' => [
                'url' => 'https://dash.cloudflare.com/',
                'badge' => 'Cloudflare Workers AI',
                'hint' => 'Qwen 2.5 Coder, Llama & DeepSeek',
            ],
            'openai' => [
                'url' => 'https://platform.openai.com/api-keys',
                'badge' => 'OpenAI Platform',
                'hint' => 'GPT-4o, o1, o3-mini & GPT-4.5',
            ],
            'anthropic' => [
                'url' => 'https://console.anthropic.com/settings/keys',
                'badge' => 'Anthropic Console',
                'hint' => 'Claude 3.7 Sonnet & Haiku 3.5',
            ],
            'deepseek' => [
                'url' => 'https://platform.deepseek.com/api_keys',
                'badge' => 'DeepSeek Open Platform',
                'hint' => 'DeepSeek V3 & R1 Reasoning',
            ],
            'xai' => [
                'url' => 'https://console.x.ai/',
                'badge' => 'xAI Console',
                'hint' => 'Grok 2 & Grok Beta',
            ],
            'groq' => [
                'url' => 'https://console.groq.com/keys',
                'badge' => 'Groq Cloud',
                'hint' => 'Llama 3 & Mixtral LPU acceleration',
            ],
            'mistral' => [
                'url' => 'https://console.mistral.ai/api-keys/',
                'badge' => 'La Plateforme Mistral',
                'hint' => 'Mistral Large, Pixtral & Codestral',
            ],
            'zhipuai' => [
                'url' => 'https://open.bigmodel.cn/usercenter/apikeys',
                'badge' => 'ZhipuAI BigModel',
                'hint' => 'GLM-4 & CodeGLM',
            ],
        ];

        $providersList = [];
        foreach ($providerConfigs as $id => $config) {
            $providerId = (string) $id;
            if ($providerId === 'webllm') {
                continue;
            }
            $cred = $settings->userCredential($user, $providerId);
            $hasKey = $cred && filled($cred->api_key);
            $isEnabled = $cred ? (bool) $cred->enabled : false;
            $masked = $settings->userMaskedKey($user, $providerId);
            $workspaceHasKey = $settings->hasStoredKey($providerId) || filled($settings->envApiKey($providerId));

            $models = array_values(array_filter($allModels, fn ($m) => $m->provider === $providerId));

            $providersList[] = [
                'id' => $providerId,
                'label' => (string) ($config['label'] ?? ucfirst($providerId)),
                'portal_url' => $portals[$providerId]['url'] ?? null,
                'portal_badge' => $portals[$providerId]['badge'] ?? ucfirst($providerId),
                'hint' => $portals[$providerId]['hint'] ?? '',
                'has_personal_key' => $hasKey,
                'is_enabled' => $isEnabled,
                'masked_key' => $masked,
                'application_id' => $cred ? (string) ($cred->application_id ?? '') : '',
                'workspace_available' => $workspaceHasKey,
                'models_count' => count($models),
            ];
        }

        $activeEditProvider = collect($providersList)->firstWhere('id', $this->editingProvider);

        return view('livewire.settings.api-keys.api-keys', [
            'providers' => $providersList,
            'activeEdit' => $activeEditProvider,
        ]);
    }
}
