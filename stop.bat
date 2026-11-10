@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Fatema Pharmacy - Stop Application
cd /d "%~dp0"

set "STOPPED=0"

echo.
echo Stopping Fatema Pharmacy application on port 3001...

:: ১. শুধুমাত্র পোর্ট ৩০০১ (Port 3001) ব্যবহারকারী Node প্রসেসটি সুনির্দিষ্টভাবে কিল করা (অন্যান্য পোর্টের অ্যাপ সুরক্ষিত থাকবে)
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":3001 .*LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>&1
    if not errorlevel 1 set "STOPPED=1"
)

:: ২. সিস্টেম ট্রের নির্দিষ্ট পাওয়ারশেল নোটিফিকেশন আইকন প্রসেস বন্ধ করা (অন্যান্য পাওয়ারশেল উইন্ডো বা অ্যাপ unaffected থাকবে)
powershell -Command "Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'NotifyIcon' } | Stop-Process -Force" >nul 2>&1

if "!STOPPED!"=="1" (
    echo Application and Tray Icon stopped successfully.
) else (
    echo No application process was listening on port 3001. System Tray refreshed.
)

echo.
echo The browser window, if open, was not closed.
pause
exit /b 0