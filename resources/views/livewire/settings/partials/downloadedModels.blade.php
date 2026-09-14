<div x-data="downloadedModelsManager" class="space-y-4">
    {{-- Toast feedback notice --}}
    <div
        x-show="toastMessage"
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0 -translate-y-1"
        x-transition:enter-end="opacity-100 translate-y-0"
        x-transition:leave="transition ease-in duration-150"
        x-transition:leave-start="opacity-100 translate-y-0"
        x-transition:leave-end="opacity-0 -translate-y-1"
        x-cloak
        class="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-xs text-teal-300 flex items-center justify-between gap-3 shadow-sm"
    >
        <div class="flex items-center gap-2 min-w-0">
            <krikkit:icon name="check" class="size-4 shrink-0 text-teal-400" />
            <span x-text="toastMessage" class="truncate font-medium"></span>
        </div>
        <button type="button" @click="toastMessage = ''" class="text-teal-400/80 hover:text-teal-200">
            <krikkit:icon name="x" class="size-3.5" />
        </button>
    </div>

    {{-- Main WebGPU Models Card --}}
    <krikkit:card class="space-y-5">
        {{-- Card Header & Storage Summary --}}
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-krikkit-line/60 pb-4">
            <div class="flex items-center gap-3">
                <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-krikkit-line/70 bg-krikkit-soft text-krikkit-fg shadow-xs">
                    <krikkit:icon name="cpu-chip" class="size-5" />
                </span>
                <div>
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-semibold text-krikkit-fg">
                            {{ __('settings.In-Browser AI Storage') }}
                        </h3>
                        <span
                            x-show="storageUsage"
                            x-text="storageUsage + ' cached'"
                            x-cloak
                            class="inline-flex items-center rounded-md bg-krikkit-soft px-2 py-0.5 text-[11px] font-medium text-krikkit-muted border border-krikkit-line/50"
                        ></span>
                    </div>
                    <p class="mt-0.5 text-xs text-krikkit-muted">
                        {{ __('settings.Downloaded weights run locally via WebGPU. Delete any model to free up local disk space.') }}
                    </p>
                </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                    type="button"
                    @click="refresh()"
                    :disabled="loading"
                    title="{{ __('settings.Refresh') }}"
                    class="inline-flex items-center justify-center size-8 rounded-lg border border-krikkit-line/70 bg-krikkit-surface text-krikkit-muted hover:text-krikkit-fg transition disabled:opacity-50"
                >
                    <krikkit:icon name="arrow-path" class="size-3.5" x-bind:class="loading ? 'animate-spin' : ''" />
                </button>

                <button
                    type="button"
                    @click="deleteAll()"
                    :disabled="! anyDownloaded || deletingAll"
                    x-show="anyDownloaded"
                    x-cloak
                    class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <krikkit:icon name="trash" class="size-3.5" />
                    <span x-show="! deletingAll">{{ __('settings.Delete all downloaded models') }}</span>
                    <span x-show="deletingAll">{{ __('settings.Deleting...') }}</span>
                </button>
            </div>
        </div>

        {{-- Browser Warning if WebGPU not supported --}}
        <div
            x-show="! webGpuAvailable && ! loading"
            x-cloak
            class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5"
        >
            <krikkit:icon name="exclamation-triangle" class="size-4 shrink-0 text-amber-400 mt-0.5" />
            <p>
                {{ __('settings.WebGPU is not detected in this browser. To use and store in-browser AI models locally, please use Chrome 113+, Edge 113+, or enable WebGPU.') }}
            </p>
        </div>

        {{-- Models List --}}
        <div class="space-y-2.5">
            <template x-for="model in models" :key="model.id">
                <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-krikkit-line/50 bg-krikkit-surface/40 p-3.5 transition hover:border-krikkit-line">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-semibold text-krikkit-fg" x-text="model.label"></span>
                            
                            {{-- Download status badge --}}
                            <template x-if="model.isDownloaded">
                                <span class="inline-flex items-center gap-1 rounded-md bg-teal-500/15 border border-teal-500/25 px-2 py-0.5 text-[10px] font-medium text-teal-400">
                                    <krikkit:icon name="check" class="size-3" />
                                    <span>{{ __('settings.Downloaded') }} (<span x-text="model.vram"></span>)</span>
                                </span>
                            </template>
                            <template x-if="! model.isDownloaded">
                                <span class="inline-flex items-center rounded-md bg-krikkit-soft px-2 py-0.5 text-[10px] font-medium text-krikkit-subtle border border-krikkit-line/50">
                                    <span>{{ __('settings.Not downloaded') }} (<span x-text="model.download"></span>)</span>
                                </span>
                            </template>

                            <span
                                class="inline-flex items-center rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-content"
                                x-text="model.id.includes('coder') ? 'Full build & chat' : 'Chat only'"
                            ></span>
                        </div>
                        <p class="mt-1 text-xs text-krikkit-muted leading-relaxed" x-text="model.description"></p>
                    </div>

                    {{-- Actions --}}
                    <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <template x-if="model.isDownloaded">
                            <button
                                type="button"
                                @click="deleteModel(model.id)"
                                :disabled="deletingId === model.id || deletingAll"
                                class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-40 cursor-pointer"
                                title="{{ __('settings.Delete model') }}"
                            >
                                <krikkit:icon name="trash" class="size-3.5" x-show="deletingId !== model.id" />
                                <krikkit:icon name="arrow-path" class="size-3.5 animate-spin" x-show="deletingId === model.id" x-cloak />
                                <span x-show="deletingId !== model.id">{{ __('settings.Delete') }}</span>
                                <span x-show="deletingId === model.id" x-cloak>{{ __('settings.Deleting...') }}</span>
                            </button>
                        </template>

                        <template x-if="! model.isDownloaded">
                            <span class="text-[11px] text-krikkit-subtle italic px-2">
                                {{ __('settings.Downloads on first use') }}
                            </span>
                        </template>
                    </div>
                </div>
            </template>
        </div>
    </krikkit:card>
</div>
