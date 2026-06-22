@echo off
echo =======================================================
echo stopping any running dev servers (ports 3000, 3001, 8081)...
echo =======================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":3000[^0-9]"') do (
    echo Killing process %%a on port 3000
    taskkill /f /pid %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":3001[^0-9]"') do (
    echo Killing process %%a on port 3001
    taskkill /f /pid %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":8081[^0-9]"') do (
    echo Killing process %%a on port 8081
    taskkill /f /pid %%a 2>nul
)

echo.
echo =======================================================
echo restarting api, web, and mobile servers concurrently...
echo =======================================================
npx concurrently --kill-others --prefix "[{name}]" --names "api,web,mobile" --prefix-colors "yellow,cyan,magenta" "npm run dev:api" "npm run dev:web" "npm run dev:mobile"
