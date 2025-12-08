@echo off
echo.
echo ========================================
echo   ELYSIA CODE COMPANION v1.0
echo   Your AI Dev Partner
echo ========================================
echo.
echo Opening app in your default browser...
echo.

REM Start Python HTTP server on port 8080
start "" python -m http.server 8080

REM Pause 2 seconds to allow server to start
timeout /t 2 >nul

REM Open homepage in default browser
start "" http://localhost:8080/index.html

echo.
echo App opened! Configure your API key in Settings.
echo.
echo Press any key to close this window...
pause > nul
