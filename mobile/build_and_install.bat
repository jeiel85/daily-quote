@echo off
setlocal EnableDelayedExpansion
echo.
echo ========================================
echo   Lumina Build ^& Install - Galaxy S24
echo ========================================
echo.

:: Project Path
cd /d D:\Project\lumina-daily\mobile

:: Set Android SDK Path
set ANDROID_HOME=C:\Users\jeiel\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\build-tools\35.0.0
set ADB="%ANDROID_HOME%\platform-tools\adb.exe"

set FALLBACK_DEVICE=192.168.45.149:5555
set TARGET_DEVICE=

:: Create local.properties if not exists
echo sdk.dir=C:/Users/jeiel/AppData/Local/Android/Sdk > android/local.properties

if not exist %ADB% (
    echo ERROR: adb.exe not found at %ADB%
    pause & exit /b 1
)

echo [0/5] Detecting Galaxy S24 (SM-S92x)...

for /f "skip=1 tokens=1,2" %%A in ('%ADB% devices') do (
    if "%%B"=="device" (
        for /f "usebackq delims=" %%M in (`%ADB% -s %%A shell getprop ro.product.model 2^>nul`) do (
            set MODEL_NAME=%%M
            echo !MODEL_NAME! | findstr /i "SM-S92" >nul
            if !errorlevel! equ 0 (
                set TARGET_DEVICE=%%A
                echo   Found: %%A ^(model: !MODEL_NAME!^)
                goto :DeviceFound
            )
        )
    )
)

:DeviceFound
if "%TARGET_DEVICE%" neq "" goto :BuildStart

echo   Auto-detect failed. Trying fallback: %FALLBACK_DEVICE%...
for /f "skip=1 tokens=1,2" %%A in ('%ADB% devices') do (
    if "%%A"=="%FALLBACK_DEVICE%" if "%%B"=="device" (
        set TARGET_DEVICE=%FALLBACK_DEVICE%
        echo   Found via fallback: %FALLBACK_DEVICE%
        goto :BuildStart
    )
)

echo ERROR: Galaxy S24 not found.
pause & exit /b 1

:BuildStart
set START_TIME=%TIME%

echo.
echo [1/5] Bundling JavaScript (Offline Mode)...
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"
call npx expo export:embed --platform android --dev false --entry-file index.ts --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
if %errorlevel% neq 0 ( echo ERROR: Bundling failed & pause & exit /b 1 )

echo.
echo [2/5] Syncing Native Assets (Icons/Names)...
call npx expo prebuild --platform android --no-install
if %errorlevel% neq 0 ( echo ERROR: Prebuild failed & pause & exit /b 1 )

echo.
echo [3/5] gradlew assembleDebug...
cd android
call gradlew assembleDebug --quiet
if %errorlevel% neq 0 ( echo ERROR: gradle build failed & pause & exit /b 1 )
cd ..

echo.
echo [4/5] adb install -> %TARGET_DEVICE%...
%ADB% -s %TARGET_DEVICE% install -r "android\app\build\outputs\apk\debug\app-debug.apk"
if %errorlevel% neq 0 ( echo ERROR: adb install failed & pause & exit /b 1 )

echo.
echo [5/5] Launching Lumina...
%ADB% -s %TARGET_DEVICE% shell am start -n com.jeiel85.luminadaily/com.jeiel85.luminadaily.MainActivity

echo.
echo ========================================
echo   Done! Device: %TARGET_DEVICE%
echo ========================================
echo.
pause
