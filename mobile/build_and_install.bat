@echo off
setlocal EnableDelayedExpansion
echo.
echo ============================================
echo   Lumina Build ^& Install - Galaxy S24
echo ============================================
echo.

:: =============================================
:: CONFIG
:: =============================================
set PROJECT_DIR=D:\Project\lumina-daily\mobile
set PACKAGE=com.jeiel85.luminadaily
set ANDROID_HOME=C:\Users\jeiel\AppData\Local\Android\Sdk
set ADB_EXE=%ANDROID_HOME%\platform-tools\adb.exe
set FALLBACK_IP=192.168.45.149:5555
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

cd /d "%PROJECT_DIR%"
(echo sdk.dir=C:/Users/jeiel/AppData/Local/Android/Sdk)>android\local.properties

:: =============================================
:: [0] DETECT DEVICE
:: =============================================
echo [0/4] Detecting Galaxy S24...

if not exist "%ADB_EXE%" (
    echo [ERROR] adb.exe not found: %ADB_EXE%
    pause & exit /b 1
)

set ADB="%ADB_EXE%"
set TARGET=

for /f "skip=1 tokens=1,2" %%A in ('%ADB% devices') do (
    if "%%B"=="device" (
        for /f "usebackq delims=" %%M in (`%ADB% -s %%A shell getprop ro.product.model 2^>nul`) do (
            set MODEL=%%M
            echo !MODEL! | findstr /i "SM-S92" >nul
            if !errorlevel! equ 0 (
                set TARGET=%%A
                echo   Found: %%A ^(!MODEL!^)
                goto :DeviceOK
            )
        )
    )
)

:: Fallback to WiFi IP
for /f "skip=1 tokens=1,2" %%A in ('%ADB% devices') do (
    if "%%A"=="%FALLBACK_IP%" if "%%B"=="device" (
        set TARGET=%FALLBACK_IP%
        echo   Fallback: %FALLBACK_IP%
        goto :DeviceOK
    )
)

echo [ERROR] Galaxy S24 not found. Check USB/WiFi connection.
pause & exit /b 1

:DeviceOK
echo.

:: =============================================
:: [1] EXPO PREBUILD
:: =============================================
echo [1/4] expo prebuild (native sync)...
call npx expo prebuild --platform android --no-install
if %errorlevel% neq 0 (
    echo [ERROR] Prebuild failed.
    pause & exit /b 1
)

:: =============================================
:: [2] JS BUNDLE (embed into APK)
:: =============================================
echo.
echo [2/4] Bundling JavaScript...
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"
call npx expo export:embed ^
    --platform android ^
    --dev false ^
    --entry-file index.ts ^
    --bundle-output android\app\src\main\assets\index.android.bundle
if %errorlevel% neq 0 (
    echo [ERROR] JS bundle failed.
    pause & exit /b 1
)

:: =============================================
:: [3] GRADLE BUILD + INSTALL
:: =============================================
echo.
echo [3/4] Gradle installDebug -> %TARGET%...
copy /Y lumina-debug.keystore android\app\debug.keystore >nul

cd android
set ANDROID_SERIAL=%TARGET%
call gradlew installDebug
if %errorlevel% neq 0 (
    echo [ERROR] Gradle build/install failed.
    cd ..
    pause & exit /b 1
)
cd ..

:: =============================================
:: [4] LAUNCH APP
:: =============================================
echo.
echo [4/4] Launching Lumina...
%ADB% -s %TARGET% shell am start -n %PACKAGE%/%PACKAGE%.MainActivity

echo.
echo ============================================
echo   Done^^! Device: %TARGET%
echo ============================================
echo.
pause
