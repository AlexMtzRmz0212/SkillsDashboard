@echo off
rem Start Skills Dashboard in development mode (live reload on code changes).
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :error
)

call npm run dev || goto :error
exit /b 0

:error
echo.
echo Something went wrong. See the messages above.
pause
exit /b 1
