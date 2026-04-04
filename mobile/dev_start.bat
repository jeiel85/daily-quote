@echo off
echo.
echo ============================================
echo   Lumina Dev Start
echo   Save code -> App updates instantly
echo ============================================
echo.

cd /d D:\Project\lumina-daily\mobile

set ANDROID_HOME=C:\Users\jeiel\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

npx expo start --android
