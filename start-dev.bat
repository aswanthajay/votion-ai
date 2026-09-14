@echo off
title Votion AI Development Environment
echo ===================================================
echo               Starting Votion AI
echo ===================================================
echo.

:: 1. Check MariaDB
netstat -ano | findstr :3306 >nul
if %errorlevel% neq 0 (
    echo [1/3] Starting MariaDB server...
    start " MariaDB Server\ /min \C:\Users\aghil\.stellar_tools\mariadb\bin\mariadbd.exe\ --defaults-file=\C:\Users\aghil\.stellar_tools\mariadb\my.ini\ --console
 timeout /t 2 /nobreak >nul
) else (
 echo [1/3] MariaDB is already running on port 3306.
)

:: 2. Launch Vite in background window
echo [2/3] Starting Vite frontend server...
start \Votion AI - Vite\ cmd /k \npm run dev\

:: 3. Launch Laravel Artisan Serve
echo [3/3] Starting Laravel backend server at http://127.0.0.1:8000...
echo.
echo ===================================================
echo Web Application: http://127.0.0.1:8000
echo Login URL: http://127.0.0.1:8000/login
echo Admin Email: admin@votion.ai
echo Admin Password: password123
echo ===================================================
echo.
php artisan serve --port=8000
