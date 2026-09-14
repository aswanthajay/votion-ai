@props([
    'user',
    'site',
    'planTitle',
    'packOffer' => null,
])

<div
    class="flex min-h-screen bg-krikkit-canvas"
    x-data="{
        navOpen: false,
        desktop: false,
        init() {
            const mq = window.matchMedia('(min-width: 1024px)')
            const sync = () => {
                this.desktop = mq.matches
                if (this.desktop) this.navOpen = false
            }
            sync()
            mq.addEventListener('change', sync)
        },
        openNav() { this.navOpen = true },
        closeNav() { this.navOpen = false },
        toggleNav() { this.navOpen = ! this.navOpen },
    }"
    x-on:keydown.escape.window="if (navOpen) closeNav()"
>
    <div
        x-cloak
        x-show="navOpen"
        x-transition.opacity.duration.200ms
        class="fixed inset-0 z-40 bg-black/40 lg:hidden"
        x-on:click="closeNav()"
    ></div>

    @include('livewire.studio.partials.sidebar')

    <div class="relative flex min-w-0 flex-1 flex-col bg-krikkit-canvas">
        {{-- Animated Background Shade --}}
        <div class="pointer-events-none absolute inset-x-0 top-0 z-0 h-[38rem] overflow-hidden select-none" aria-hidden="true">
            {{-- Central breathing radial glow --}}
            <div class="studio-shade-core absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_32%,transparent),transparent_75%)]"></div>

            {{-- Drifting primary glowing orb (top-right drift) --}}
            <div class="studio-shade-drift-right absolute -top-24 right-[10%] h-[32rem] w-[38rem] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--color-accent)_38%,transparent),transparent_65%)] blur-3xl"></div>

            {{-- Drifting secondary ambient orb (top-left drift) --}}
            <div class="studio-shade-drift-left absolute -top-28 left-[10%] h-[28rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--color-accent)_24%,transparent),transparent_65%)] blur-3xl"></div>

            {{-- Soft atmospheric shimmer veil --}}
            <div class="studio-shade-shimmer absolute inset-0 bg-[radial-gradient(ellipse_65%_45%_at_55%_12%,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_60%)]"></div>

            {{-- Bottom fade veil smoothly melding into canvas --}}
            <div class="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent to-krikkit-canvas"></div>
        </div>

        <style>
            @keyframes studio-shade-breathe {
                0%, 100% { opacity: 0.65; transform: scale3d(1, 1, 1) translateY(0); }
                50% { opacity: 0.98; transform: scale3d(1.08, 1.05, 1) translateY(1.5%); }
            }
            @keyframes studio-orbit-right {
                0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.7; }
                25% { transform: translate3d(6%, 10%, 0) scale(1.12); opacity: 0.95; }
                50% { transform: translate3d(-12%, 14%, 0) scale(0.92); opacity: 0.65; }
                75% { transform: translate3d(-18%, 2%, 0) scale(1.06); opacity: 0.85; }
            }
            @keyframes studio-orbit-left {
                0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.6; }
                33% { transform: translate3d(-10%, 12%, 0) scale(1.14); opacity: 0.85; }
                66% { transform: translate3d(14%, -6%, 0) scale(0.9); opacity: 0.6; }
            }
            @keyframes studio-shimmer {
                0%, 100% { opacity: 0.35; transform: scale3d(0.95, 0.95, 1) translate3d(-4%, 0, 0); }
                50% { opacity: 0.75; transform: scale3d(1.06, 1.04, 1) translate3d(4%, 3%, 0); }
            }
            .studio-shade-core { animation: studio-shade-breathe 10s ease-in-out infinite; will-change: transform, opacity; }
            .studio-shade-drift-right { animation: studio-orbit-right 20s ease-in-out infinite; will-change: transform, opacity; }
            .studio-shade-drift-left { animation: studio-orbit-left 25s ease-in-out infinite; will-change: transform, opacity; }
            .studio-shade-shimmer { animation: studio-shimmer 14s ease-in-out infinite; will-change: transform, opacity; }
            @media (prefers-reduced-motion: reduce) {
                .studio-shade-core, .studio-shade-drift-right, .studio-shade-drift-left, .studio-shade-shimmer {
                    animation: none !important; transform: none !important;
                }
            }
        </style>
        <div class="relative z-10 mx-auto flex min-h-0 w-full max-w-screen-2xl flex-1 flex-col">
            @include('livewire.studio.partials.header')
            <div class="flex min-h-0 flex-1 flex-col">
                {{ $slot }}
            </div>
            @include('livewire.studio.partials.footer')
        </div>
    </div>
</div>
