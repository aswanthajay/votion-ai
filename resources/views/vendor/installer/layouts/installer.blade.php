<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <x-layouts.partials.brand />
    <x-layouts.partials.seo />
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=sora:400,500,600,700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ route('installer.assets.css') }}">
    @php
        $accent = config('installer.theme.accent', config('installer.theme.primary', '#262626'));
        $accentForeground = config('installer.theme.accent_foreground', '#ffffff');
        $accentDark = config('installer.theme.accent_dark', '#ffffff');
        $accentDarkForeground = config('installer.theme.accent_dark_foreground', '#1a1a1a');
        $themeMode = config('installer.theme.mode', 'system');
    @endphp
    <style>
        :root {
            --theme-accent: {{ $accent }};
            --theme-accent-foreground: {{ $accentForeground }};
            --theme-accent-dark: {{ $accentDark }};
            --theme-accent-dark-foreground: {{ $accentDarkForeground }};
        }
        html { background-color: var(--color-krikkit-canvas, #fff); color-scheme: light; }
        html.dark { background-color: var(--color-krikkit-canvas, #0a0a0a); color-scheme: dark; }
        [x-cloak] { display: none !important; }
        .installer-sidebar {
            justify-content: flex-start;
        }
        .installer-brand-logo {
            display: block;
            height: 2rem;
            width: auto;
            max-width: 10rem;
            object-fit: contain;
            object-position: left center;
        }
        .installer-actions-end {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 0.75rem;
            margin-left: auto;
        }
        .btn.btn--continue,
        .btn.btn--back {
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
        }
        .btn .btn-text-icon {
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            line-height: 1;
            white-space: nowrap;
        }
        .btn .btn-text-icon--busy {
            display: none;
        }
        .btn [wire\:loading\.flex],
        .btn [wire\:loading] {
            align-items: center;
            justify-content: center;
            flex-direction: row;
            gap: 0.5rem;
        }
        .btn.is-finishing .btn-text-icon--idle,
        .btn.is-finishing [wire\:loading\.flex],
        .btn.is-finishing [wire\:loading] {
            display: none !important;
        }
        .btn.is-finishing .btn-text-icon--busy[x-cloak],
        .btn.is-finishing .btn-text-icon--busy {
            display: inline-flex !important;
        }
        .btn .spinner {
            display: inline-block;
            flex: 0 0 1rem;
            box-sizing: border-box;
            margin: 0;
            width: 1rem;
            height: 1rem;
            vertical-align: middle;
        }
        .btn svg {
            display: block;
            flex: 0 0 1rem;
            width: 1rem;
            height: 1rem;
        }
    </style>
    <script>
        (() => {
            const configured = @js($themeMode);
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const dark = configured === 'dark' || (configured === 'system' && prefersDark);
            document.documentElement.classList.toggle('dark', dark);
            document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        })();
    </script>
    @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    @else
        <script src="https://cdn.tailwindcss.com"></script>
        <script>tailwind.config = { darkMode: 'class' }</script>
    @endif
    <x-layouts.partials.themeStyle />
    @livewireStyles
</head>
<body class="font-sans antialiased">
    {{ $slot }}
    <krikkit:toast />
    @livewireScripts
</body>
</html>
