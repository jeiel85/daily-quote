@echo off
echo.
echo ============================================
echo   Lumina Dev Setup (Run Once)
echo   Installs dev build with native modules
echo ============================================
echo.
echo Build time: ~3-5 minutes
echo After this, use dev_start.bat for fast dev.
echo.
pause

cd /d D:\Project\lumina-daily\mobile

set ANDROID_HOME=C:\Users\jeiel\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

(echo sdk.dir=C:/Users/jeiel/AppData/Local/Android/Sdk)>android\local.properties

:: Prebuild first to generate android/ project
call npx expo prebuild --platform android --no-install
if %errorlevel% neq 0 ( echo [ERROR] Prebuild failed & pause & exit /b 1 )

:: Replace keystore with our registered one (SHA1: 97255E13...)
copy /Y lumina-debug.keystore android\app\debug.keystore >nul
echo [OK] Keystore applied.

:: Build and install via Gradle, then start Metro
cd android
set ANDROID_HOME=C:\Users\jeiel\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools
call gradlew installDebug
if %errorlevel% neq 0 ( echo [ERROR] Build failed & cd .. & pause & exit /b 1 )
cd ..

:: Start Metro for Fast Refresh
npx expo start --android

echo.
pause
