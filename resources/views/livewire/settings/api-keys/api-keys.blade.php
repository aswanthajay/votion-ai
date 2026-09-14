<x-settings.frame section="api-keys">
    <div class="space-y-8">
        <div>
            <h1 class="text-2xl font-semibold tracking-tight text-krikkit-fg">{{ __('settings.AI API Keys (BYOK)') }}</h1>
            <p class="mt-1 text-sm text-krikkit-muted">
                {{ __('settings.Configure personal provider API keys to use your own quota and bypass monthly credit deductions.') }}
            </p>
        </div>

        {{-- BYOK Overview Notice Card --}}
        <krikkit:card class="border-sky-500/20 bg-sky-500/5">
            <div class="flex items-start gap-4">
                <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-400">
                    <krikkit:icon name="key" class="size-5" />
                </span>
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-krikkit-fg">{{ __('settings.Bring Your Own Key (BYOK)') }}</p>
                    <p class="mt-1 text-sm text-krikkit-muted leading-relaxed">
                        {{ __('settings.When you add your own API key for an AI provider, Lab uses your personal credentials directly. Turns run on your own key are completely free of workspace credits and bypass monthly limits.') }}
                    </p>
                </div>
            </div>
        </krikkit:card>

        {{-- Providers List --}}
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-krikkit-muted">{{ __('settings.Supported Providers') }}</p>
                <span class="text-xs text-krikkit-subtle">{{ count($providers) }} {{ __('dashboard.Providers') }}</span>
            </div>

            <div class="space-y-3">
                @foreach ($providers as $item)
                    <krikkit:card class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex min-w-0 flex-1 items-start gap-4">
                            <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-krikkit-line bg-krikkit-soft text-krikkit-fg">
                                <krikkit:icon name="cpu-chip" class="size-5" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-semibold text-krikkit-fg">{{ $item['label'] }}</p>
                                    @if ($item['has_personal_key'] && $item['is_enabled'])
                                        <krikkit:badge color="teal" size="xs">
                                            {{ __('settings.Active') }} · {{ $item['masked_key'] }}
                                        </krikkit:badge>
                                    @elseif ($item['has_personal_key'])
                                        <krikkit:badge color="zinc" size="xs">
                                            {{ __('settings.Disabled') }} · {{ $item['masked_key'] }}
                                        </krikkit:badge>
                                    @elseif ($item['workspace_available'])
                                        <krikkit:badge color="sky" size="xs">
                                            {{ __('settings.Using workspace key') }}
                                        </krikkit:badge>
                                    @else
                                        <krikkit:badge color="amber" size="xs">
                                            {{ __('settings.No personal key') }}
                                        </krikkit:badge>
                                    @endif
                                </div>
                                <p class="mt-1 text-xs text-krikkit-muted">
                                    {{ $item['hint'] }}
                                    @if ($item['models_count'] > 0)
                                        <span class="text-krikkit-subtle">· {{ $item['models_count'] }} {{ __('dashboard.Models') }}</span>
                                    @endif
                                </p>
                                @if ($item['portal_url'])
                                    <a
                                        href="{{ $item['portal_url'] }}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="mt-1.5 inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition"
                                    >
                                        <span>{{ __('settings.Get API key') }}</span>
                                        <krikkit:icon name="arrow-top-right-on-square" class="size-3" />
                                    </a>
                                @endif
                            </div>
                        </div>

                        <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                            @if ($item['has_personal_key'])
                                <button
                                    type="button"
                                    wire:click="toggleEnabled('{{ $item['id'] }}')"
                                    title="{{ $item['is_enabled'] ? __('settings.Personal key enabled.') : __('settings.Personal key disabled.') }}"
                                    class="text-xs px-2.5 py-1.5 rounded border border-krikkit-line hover:border-krikkit-fg-soft text-krikkit-fg-soft transition"
                                >
                                    {{ $item['is_enabled'] ? __('dashboard.Disable') : __('dashboard.Enable') }}
                                </button>
                                <krikkit:button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    wire:click="openEdit('{{ $item['id'] }}')"
                                >
                                    {{ __('settings.Edit') }}
                                </krikkit:button>
                                <button
                                    type="button"
                                    wire:click="confirmDelete('{{ $item['id'] }}')"
                                    class="p-1.5 text-krikkit-subtle hover:text-red-400 transition"
                                    title="{{ __('settings.Remove') }}"
                                >
                                    <krikkit:icon name="trash" class="size-4" />
                                </button>
                            @else
                                <krikkit:button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    wire:click="openEdit('{{ $item['id'] }}')"
                                >
                                    {{ __('settings.Configure') }}
                                </krikkit:button>
                            @endif
                        </div>
                    </krikkit:card>
                @endforeach
            </div>
        </div>
    </div>

    {{-- Edit / Add Key Modal --}}
    <krikkit:modal name="edit-api-key" size="md">
        <krikkit:modal.close />
        @if ($activeEdit)
            <div class="pr-8">
                <h3 class="text-lg font-semibold text-krikkit-fg">
                    {{ __('settings.Configure API Key') }} · {{ $activeEdit['label'] }}
                </h3>
                <p class="mt-1 text-xs text-krikkit-muted">
                    {{ $activeEdit['hint'] }}
                </p>
            </div>

            <form wire:submit="save" class="mt-5 space-y-4">
                <krikkit:field :label="__('settings.API Key')">
                    <krikkit:input
                        type="password"
                        wire:model="apiKey"
                        :placeholder="$activeEdit['has_personal_key'] ? '•••••••••••••••• (' . __('dashboard.Leave blank to keep current') . ')' : __('settings.Enter your API key')"
                        :invalid="$errors->has('apiKey')"
                        autofocus
                    />
                    @error('apiKey')
                        <p class="mt-1 text-xs text-red-500">{{ $message }}</p>
                    @enderror
                </krikkit:field>

                @if ($activeEdit['id'] === 'cloudflare')
                    <krikkit:field :label="__('settings.Cloudflare Account ID')">
                        <krikkit:input
                            type="text"
                            wire:model="applicationId"
                            placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                            :invalid="$errors->has('applicationId')"
                        />
                        <p class="mt-1 text-xs text-krikkit-subtle">{{ __('settings.Required for Cloudflare Workers AI') }}</p>
                        @error('applicationId')
                            <p class="mt-1 text-xs text-red-500">{{ $message }}</p>
                        @enderror
                    </krikkit:field>
                @endif

                <div class="flex items-start justify-between gap-4 rounded-lg border border-krikkit-line/60 bg-krikkit-soft/40 p-3.5">
                    <div class="min-w-0">
                        <p class="text-sm font-medium text-krikkit-fg">{{ __('settings.Enable personal key') }}</p>
                        <p class="mt-0.5 text-xs text-krikkit-muted">
                            {{ __('settings.When enabled, this key takes priority over the shared workspace key.') }}
                        </p>
                    </div>
                    <krikkit:switch wire:model="enabled" :checked="$enabled" />
                </div>

                @if ($activeEdit['portal_url'])
                    <div class="pt-1">
                        <a
                            href="{{ $activeEdit['portal_url'] }}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition"
                        >
                            <span>{{ __('settings.Get API key') }} ({{ $activeEdit['portal_badge'] }})</span>
                            <krikkit:icon name="arrow-top-right-on-square" class="size-3.5" />
                        </a>
                    </div>
                @endif

                <div class="mt-6 flex justify-end gap-2">
                    <krikkit:button
                        type="button"
                        variant="ghost"
                        @click="$dispatch('krikkit-modal-close', 'edit-api-key')"
                    >
                        {{ __('dashboard.Cancel') }}
                    </krikkit:button>
                    <krikkit:button type="submit">
                        {{ __('settings.Save Key') }}
                    </krikkit:button>
                </div>
            </form>
        @endif
    </krikkit:modal>

    {{-- Delete Confirmation Modal --}}
    <krikkit:confirm
        name="delete-api-key"
        :title="__('settings.Remove API Key')"
        :copy="__('settings.Are you sure you want to remove your personal API key for this provider? Lab will fall back to using the shared workspace key.')"
    >
        <x-slot:action>
            <krikkit:button type="button" variant="danger" wire:click="deleteKey">
                {{ __('settings.Remove Key') }}
            </krikkit:button>
        </x-slot:action>
    </krikkit:confirm>
</x-settings.frame>
