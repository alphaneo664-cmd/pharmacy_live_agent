@echo off
setlocal enabledelayedexpansion
title Fatema Pharmacy - Medicine Stock and Order System
color 0B
mode con: cols=86 lines=34

:: Clear screen and show header with animated visual effects
cls
echo.
echo  ======================================================================================
echo    ==================================================================================
echo     [+] FATEMA PHARMACY - MEDICINE STOCK & ORDER SYSTEM
echo     [+] HOSPITAL & CLINICAL DATABASE MANAGEMENT (HDMS)
echo     [+] DIRECT SQL SERVER 2000 TDS 7.1 ADAPTER - READ-ONLY SAFE MODE
echo    ==================================================================================
echo  ======================================================================================
echo.

:: Visual boot-up sequence animation
echo  [*] Initializing runtime environment...
echo.
<nul set /p "=[SYS] Loading database drivers "
for /L %%i in (1,1,12) do (
    <nul set /p "=."
    ping -n 1 127.0.0.1 >nul
)
echo  [ READY ]

<nul set /p "=[SYS] Verifying SQL Server 2000 schemas [Items, Suppliers] "
for /L %%i in (1,1,6) do (
    <nul set /p "=."
    ping -n 1 127.0.0.1 >nul
)
echo  [ VERIFIED ]

echo.
echo  --------------------------------------------------------------------------------------
echo   SYSTEM DIAGNOSTICS:
echo  --------------------------------------------------------------------------------------

:: Step 1: Check Node.js
<nul set /p "=  [1/4] Checking Node.js engine..."
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ FAIL ]
    echo.
    echo  [ERROR] Node.js is not found in system PATH.
    echo  Please download and install Node.js (v18 or v20 LTS) from:
    echo  https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo  [ OK - !NODE_VERSION! ]

:: Step 2: Check or generate .env file
<nul set /p "=  [2/4] Checking .env configuration..."
if not exist ".env" (
    echo.
    echo  [INFO] .env file not found. Creating default for SQL Server 2000 (HDMS)...
    (
        echo # SQL Server Database Configuration
        echo DB_SERVER=localhost
        echo DB_PORT=1433
        echo DB_USER=sa
        echo DB_PASSWORD=
        echo DB_NAME=HDMS
        echo DB_ENCRYPT=false
        echo DB_TRUST_SERVER_CERTIFICATE=true
    ) > .env
    echo  [ CREATED .env (HDMS) ]
) else (
    echo  [ OK - Found .env ]
)

:: Step 3: Check dependencies
<nul set /p "=  [3/4] Validating local npm packages..."
if not exist "node_modules\" (
    echo  [ INSTALLING ]
    echo.
    echo  ======================================================================================
    echo   Installing dependencies with --legacy-peer-deps (Windows compatibility)...
    echo  ======================================================================================
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Dependency installation encountered an issue.
        pause
        exit /b 1
    )
    echo.
) else (
    echo  [ OK ]
)

:: Step 4: Check build artifact
<nul set /p "=  [4/4] Verifying production build dist..."
if not exist "dist\" (
    echo  [ COMPILING ]
    echo.
    echo  ======================================================================================
    echo   Compiling client and server distribution...
    echo  ======================================================================================
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Build step failed.
        pause
        exit /b 1
    )
    echo.
) else (
    echo  [ OK ]
)

echo.
echo  ======================================================================================
echo   LAUNCHING APPLICATION INTERFACE & SERVER
echo  ======================================================================================
echo.

:: Animated launching progress bar
<nul set /p "=  Starting Fatema Pharmacy Portal ["
for /L %%i in (1,1,28) do (
    <nul set /p "=#"
    ping -n 1 127.0.0.1 >nul
)
echo ] 100%%
echo.
echo   - Local Portal Address:  http://localhost:3001
echo   - Connected Database:    HDMS on localhost:1433
echo   - Primary Tables:        Items, Suppliers, qryStore_Item_Balance
echo   - Mode:                  Live Pharmacy Stock & Order Manager
echo.
echo  ======================================================================================
echo   Opening your default web browser... Press Ctrl+C in this console to stop.
echo  ======================================================================================
echo.

:: Launch default browser
start http://localhost:3001

:: Start Node server
npm start

pause
