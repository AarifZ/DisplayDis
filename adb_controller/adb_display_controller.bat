@echo off
setlocal

:: IMPORTANT: Update this path to your DisplayToggle.dex file
:: Ensure DisplayToggle.dex is in the same directory as this batch file.
set "DEX_FILE=%~dp0DisplayToggle.dex"
set "REMOTE_DEX_PATH=/storage/emulated/0/DisplayToggle.dex"

:: Attempt to find ADB.EXE
set "ADB_PATH="
where adb.exe >nul 2>nul
if %errorlevel% equ 0 (
    set "ADB_PATH=adb"
) else (
    :: Common Android SDK paths
    if exist "%LOCALAPPDATA%\Android\sdk\platform-tools\adb.exe" (
        set "ADB_PATH=%LOCALAPPDATA%\Android\sdk\platform-tools\adb.exe"
    ) else if exist "%PROGRAMFILES%\Android\sdk\platform-tools\adb.exe" (
        set "ADB_PATH=%PROGRAMFILES%\Android\sdk\platform-tools\adb.exe"
    )
)

if not defined ADB_PATH (
    echo.
    echo ERROR: ADB.EXE not found in system PATH or common SDK locations.
    echo Please ensure ADB is installed and added to your system PATH, or manually specify its full path.
    echo.
    set /p ADB_PATH="Enter full path to adb.exe (e.g., C:\Android\platform-tools\adb.exe): "
    if not exist "%ADB_PATH%" (
        echo Invalid ADB path. Exiting.
        pause
        exit /b 1
    )
)

echo.
echo Using ADB from: "%ADB_PATH%"
echo.

:: Track pushed DEX for devices (simple method, might re-push)
:: For persistent state, consider a small text file or more advanced methods.
set "DEX_PUSHED_DEVICES="

:MENU
cls
echo ====================================
echo   ADB Display Controller (Windows)
echo ====================================
echo 1. List Wireless Devices
echo 2. List USB Devices
echo 3. Toggle Display OFF (Enter Device ID)
echo 4. Toggle Display ON (Enter Device ID)
echo 5. Exit
echo.
set /p CHOICE="Enter your choice: "

if "%CHOICE%"=="1" goto LIST_WIRELESS
if "%CHOICE%"=="2" goto LIST_USB
if "%CHOICE%"=="3" goto TOGGLE_OFF
if "%CHOICE%"=="4" goto TOGGLE_ON
if "%CHOICE%"=="5" goto END

echo Invalid choice.
pause
goto MENU

:LIST_WIRELESS
cls
echo Listing Wireless Devices (IPs)...
echo ---------------------------------
"%ADB_PATH%" devices -l | findstr /R /C:"[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*:[0-9]* device"
echo ---------------------------------
echo.
pause
goto MENU

:LIST_USB
cls
echo Listing USB Devices (Serials)...
echo ---------------------------------
"%ADB_PATH%" devices -l | findstr /V /R /C:"[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*:[0-9]*" | findstr /C:"device"
echo ---------------------------------
echo.
pause
goto MENU

:TOGGLE_OFF
cls
set /p DEVICE_ID="Enter Device IP or Serial to turn display OFF: "
if "%DEVICE_ID%"=="" (
    echo No device ID entered.
    pause
    goto MENU
)
call :PUSH_DEX "%DEVICE_ID%"
if %errorlevel% neq 0 (
    echo Failed to push DEX. Cannot toggle display.
    pause
    goto MENU
)
echo Toggling display OFF for %DEVICE_ID%...
"%ADB_PATH%" -s "%DEVICE_ID%" shell CLASSPATH="%REMOTE_DEX_PATH%" app_process / DisplayToggle 0
if %errorlevel% equ 0 (
    echo Display OFF command sent successfully to %DEVICE_ID%.
) else (
    echo Error toggling display OFF for %DEVICE_ID%.
)
pause
goto MENU

:TOGGLE_ON
cls
set /p DEVICE_ID="Enter Device IP or Serial to turn display ON: "
if "%DEVICE_ID%"=="" (
    echo No device ID entered.
    pause
    goto MENU
)
call :PUSH_DEX "%DEVICE_ID%"
if %errorlevel% neq 0 (
    echo Failed to push DEX. Cannot toggle display.
    pause
    goto MENU
)
echo Toggling display ON for %DEVICE_ID%...
"%ADB_PATH%" -s "%DEVICE_ID%" shell CLASSPATH="%REMOTE_DEX_PATH%" app_process / DisplayToggle 1
if %errorlevel% equ 0 (
    echo Display ON command sent successfully to %DEVICE_ID%.
) else (
    echo Error toggling display ON for %DEVICE_ID%.
)
pause
goto MENU

:: Subroutine to push DEX file
:PUSH_DEX
set "DEVICE_ID_TO_PUSH=%~1"
if not exist "%DEX_FILE%" (
    echo ERROR: DisplayToggle.dex not found at: "%DEX_FILE%". Please ensure it's in the same directory as this script.
    exit /b 1
)

:: Check if DEX was already pushed to this device (very simple check)
echo %DEX_PUSHED_DEVICES% | findstr /C:"%DEVICE_ID_TO_PUSH%" >nul
if %errorlevel% equ 0 (
    echo DEX already pushed to %DEVICE_ID_TO_PUSH%. Skipping push.
    exit /b 0
)

echo Pushing %DEX_FILE% to %DEVICE_ID_TO_PUSH%...
"%ADB_PATH%" -s "%DEVICE_ID_TO_PUSH%" push "%DEX_FILE%" "%REMOTE_DEX_PATH%"
if %errorlevel% equ 0 (
    echo DEX pushed successfully to %DEVICE_ID_TO_PUSH%.
    set "DEX_PUSHED_DEVICES=%DEX_PUSHED_DEVICES% %DEVICE_ID_TO_PUSH%"
    exit /b 0
) else (
    echo Error pushing DEX to %DEVICE_ID_TO_PUSH%.
    exit /b 1
)

:END
echo Exiting ADB Display Controller.
pause
endlocal
exit /b 0