@php
    $allStepIds = array_keys($steps);
    $currentIndex = array_search($step->id(), $allStepIds);
    $appName = config('installer.name', 'Installer');
    $brandLetter = mb_strtoupper(mb_substr($appName, 0, 1));
    $logo = config('installer.logo');
@endphp

<div
    class="installer-page"
    x-data="{
        loading: @entangle('loading'),
        error: null,
        isFinishing: false,
        isSuccess: false,
        redirectUrl: '',
        stepKey: 0
    }"
    x-on:installer-finishing.window="isFinishing = true"
    x-on:installation-success.window="
        isFinishing = false;
        isSuccess = true;
        redirectUrl = $event.detail[0].redirectUrl || '/admin';
    "
    x-on:step-changed.window="stepKey++"
    x-cloak
>
    <aside class="installer-sidebar">
        <div class="installer-sidebar-top">
            <div class="installer-brand">
                @if($logo)
                    <img src="{{ $logo }}" alt="{{ $appName }}" class="installer-brand-logo">
                @else
                    <span class="installer-brand-mark">{{ $brandLetter }}</span>
                    <span class="installer-brand-name">{{ $appName }}</span>
                @endif
            </div>

            <p class="installer-eyebrow">{{ __('installer::installer.eyebrow') }}</p>
            <p class="installer-tagline">{{ __('installer::installer.tagline') }}</p>
            <span class="installer-accent-bar" aria-hidden="true"></span>
        </div>

        <nav class="installer-progress" aria-label="{{ __('installer::installer.eyebrow') }}">
            <div class="installer-progress-list">
                @php $currentFound = false; @endphp
                @foreach($steps as $s)
                    @php
                        $isCurrent = $s->id() === $step->id();
                        if ($isCurrent) $currentFound = true;
                        $isPast = ! $currentFound && ! $isCurrent;
                    @endphp
                    @if($isPast)
                        <button type="button" wire:click="goToStep('{{ $s->id() }}')" class="installer-progress-item installer-progress-item--past">
                            <span class="installer-progress-indicator" aria-hidden="true">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <span class="installer-progress-label">{{ $s->label() }}</span>
                        </button>
                    @else
                        <div class="installer-progress-item {{ $isCurrent ? 'installer-progress-item--current' : 'installer-progress-item--future' }}" @if($isCurrent) aria-current="step" @endif>
                            <span class="installer-progress-indicator">{{ $loop->iteration }}</span>
                            <span class="installer-progress-label">{{ $s->label() }}</span>
                        </div>
                    @endif
                @endforeach
            </div>
        </nav>
    </aside>

    <div class="installer-content">
        <div class="installer-content-inner">
            <div class="installer-panel">
                <div class="installer-mobile-brand">
                    @if($logo)
                        <img src="{{ $logo }}" alt="{{ $appName }}" class="installer-brand-logo">
                    @else
                        <span class="installer-brand-mark">{{ $brandLetter }}</span>
                        <span class="installer-brand-name">{{ $appName }}</span>
                    @endif
                </div>

                <div class="installer-mobile-meta">
                    <p class="installer-step-counter">
                        {{ __('installer::installer.step_of', ['current' => $currentIndex + 1, 'total' => count($steps)]) }}
                    </p>
                    <div class="installer-progress-dots" aria-hidden="true">
                        @php $dotFound = false; @endphp
                        @foreach($steps as $s)
                            @php
                                $isCurrent = $s->id() === $step->id();
                                if ($isCurrent) $dotFound = true;
                                $isPast = ! $dotFound && ! $isCurrent;
                            @endphp
                            <span class="installer-progress-dot {{ $isCurrent ? 'installer-progress-dot--current' : ($isPast ? 'installer-progress-dot--past' : 'installer-progress-dot--future') }}"></span>
                        @endforeach
                    </div>
                </div>

                @include('installer.partials.pulses')

                <form
                    class="installer-form"
                    x-show="!isSuccess"
                    wire:submit.prevent="window.__krikkitInstallerPulseSig = null; $wire.next()"
                >
                    <div
                        class="installer-form-body"
                        x-data
                        x-show="true"
                        x-transition:enter="installer-step-enter"
                        x-transition:enter-start="installer-step-enter-start"
                        x-transition:enter-end="installer-step-enter-end"
                        :key="stepKey"
                    >
                        @include($step->view())
                    </div>

                    <div class="installer-actions">
                        @if(!$isFirstStep)
                            <button type="button" wire:key="back-btn" wire:click="previous" wire:loading.attr="disabled" class="btn btn--back">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                {{ __('installer::installer.btn_back') }}
                            </button>
                        @else
                            <div wire:key="no-back-btn"></div>
                        @endif

                        <div class="installer-actions-end">
                            @if($step->id() === 'permit')
                                <button
                                    type="button"
                                    wire:key="skip-permit-btn"
                                    class="btn btn--back"
                                    wire:loading.attr="disabled"
                                    x-on:click="window.__krikkitInstallerPulseSig = null; $wire.set('state.permit_token', '').then(() => $wire.next())"
                                >
                                    {{ __('dashboard.Skip for now') }}
                                </button>
                            @endif

                            <button
                                type="submit"
                                wire:loading.attr="disabled"
                                :disabled="isFinishing"
                                class="btn btn--continue"
                                :class="{ 'is-finishing': isFinishing }"
                            >
                                <span wire:loading.remove wire:target="next" class="btn-text-icon btn-text-icon--idle">
                                    <span>{{ $isLastStep ? __('installer::installer.btn_complete') : __('installer::installer.btn_continue') }}</span>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>

                                <span class="btn-text-icon btn-text-icon--busy" x-cloak x-show="isFinishing">
                                    <span class="spinner" aria-hidden="true"></span>
                                    <span>{{ __('installer::installer.btn_finalizing') }}</span>
                                </span>

                                <span wire:loading.flex wire:target="next" class="btn-text-icon btn-text-icon--busy">
                                    <span class="spinner" aria-hidden="true"></span>
                                    <span>{{ __('installer::installer.btn_processing') }}</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </form>

                <div class="installer-success" x-show="isSuccess" x-cloak style="display: none;">
                    <div class="installer-success-mark" aria-hidden="true">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 class="installer-success-title">{{ __('installer::installer.success_title') }}</h2>
                    <p class="installer-success-copy">{{ __('installer::installer.success_copy') }}</p>
                    <a :href="redirectUrl" class="btn btn--continue">
                        <span class="btn-text-icon">
                            {{ __('installer::installer.success_login') }}
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </span>
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>
