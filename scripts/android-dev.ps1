# Low-RAM Android build for Windows. Use via android-build-launcher.ps1 (separate window).
param(
  [switch]$InProcess,
  [switch]$Clean,
  [switch]$CleanOnly,
  [switch]$EmuOnly,
  [switch]$Prebuild,
  [switch]$InstallOnly,
  [switch]$KeepEmulatorRunning,
  [switch]$Device,
  [string]$Abi = '',
  [switch]$SkipLongPathCheck
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
Set-Location $ProjectRoot

# Target CPU architecture for the native libraries baked into the APK.
#   x86_64    -> Android emulator (default)
#   arm64-v8a -> physical phones/tablets (use -Device or -Abi arm64-v8a)
# An x86_64-only APK fails to install on an ARM phone ("App not installed").
if (-not $Abi) { $Abi = if ($Device) { 'arm64-v8a' } else { 'x86_64' } }

$GradleHome = 'C:\g'
$MinFreeRamGb = 8
$ApkPath = Join-Path $ProjectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'

# NDK version expected by Expo 54 / RN 0.81. If the default SDK location lives under
# a user profile whose path contains a space (e.g. "C:\Users\Jane Doe\..."), that
# space in the NDK path makes CMake/Clang silently drop libc++_shared, producing "undefined symbol:
# std::__ndk1::*" linker errors in react-native-worklets / reanimated. We keep a
# copy on a no-space path and point the build at it.
$NdkVersion = '27.1.12297006'
$NoSpaceNdk = "C:\ndk\$NdkVersion"

# Re-launch in external PowerShell so Cursor is not the parent of Gradle/Java.
if (-not $InProcess) {
  $launcher = Join-Path $ProjectRoot 'scripts\android-build-launcher.ps1'
  $args = @()
  if ($Clean) { $args += '-Clean' }
  if ($CleanOnly) { $args += '-CleanOnly' }
  if ($EmuOnly) { $args += '-EmuOnly' }
  if ($Prebuild) { $args += '-Prebuild' }
  if ($InstallOnly) { $args += '-InstallOnly' }
  if ($KeepEmulatorRunning) { $args += '-KeepEmulatorRunning' }
  if ($Device) { $args += '-Device' }
  if ($Abi) { $args += @('-Abi', $Abi) }
  & $launcher @args
  exit $LASTEXITCODE
}

function Resolve-JavaHome {
  foreach ($c in @(
    'C:\Program Files\Android\Android Studio\jbr',
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
  )) {
    if (Test-Path "$c\bin\java.exe") { return $c }
  }
  return $null
}

function ConvertTo-PropPath([string]$p) {
  # Escape a Windows path for a Java .properties file (sdk.dir / ndk.dir).
  return ($p -replace '\\', '\\') -replace ':', '\:'
}

function Set-NoSpaceNdk {
  # Ensure a copy of the NDK exists on a path without spaces, then point the
  # build at it via android\local.properties + env vars, and wipe stale CMake
  # caches (.cxx) that baked in the old spaced path.
  $sdkNdk = Join-Path $env:ANDROID_HOME "ndk\$NdkVersion"

  if (-not (Test-Path (Join-Path $NoSpaceNdk 'build\cmake\android.toolchain.cmake'))) {
    if (Test-Path (Join-Path $sdkNdk 'build\cmake\android.toolchain.cmake')) {
      Write-Host "Copying NDK $NdkVersion to no-space path $NoSpaceNdk (one-time, ~2 GB)..."
      New-Item -ItemType Directory -Force -Path (Split-Path $NoSpaceNdk -Parent) | Out-Null
      robocopy $sdkNdk $NoSpaceNdk /E /NFL /NDL /NJH /NJS /NP | Out-Null
    } else {
      Write-Host "WARNING: NDK $NdkVersion not found at $sdkNdk; skipping no-space NDK setup." -ForegroundColor Yellow
      return
    }
  }

  # local.properties so Gradle/AGP use the no-space NDK.
  $localProps = Join-Path $ProjectRoot 'android\local.properties'
  $sdkProp = ConvertTo-PropPath $env:ANDROID_HOME
  $ndkProp = ConvertTo-PropPath $NoSpaceNdk
  @(
    "sdk.dir=$sdkProp",
    "ndk.dir=$ndkProp"
  ) | Set-Content -Path $localProps -Encoding ASCII
  Write-Host "Pinned NDK -> $NoSpaceNdk (android\local.properties)"

  $env:ANDROID_NDK_HOME = $NoSpaceNdk
  $env:ANDROID_NDK_ROOT = $NoSpaceNdk
  $env:ANDROID_NDK = $NoSpaceNdk

  # Stale .cxx dirs cache the old (spaced) toolchain path in CMakeCache.txt and
  # must be removed so CMake reconfigures against the no-space NDK.
  foreach ($cxx in @(
    'android\app\.cxx',
    'node_modules\react-native-worklets\android\.cxx',
    'node_modules\react-native-reanimated\android\.cxx'
  )) {
    $full = Join-Path $ProjectRoot $cxx
    if (Test-Path $full) {
      Write-Host "Clearing stale CMake cache: $cxx"
      Remove-Item -Recurse -Force $full -ErrorAction SilentlyContinue
    }
  }
}

function Get-LongPathsEnabled {
  (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled -eq 1
}

function Assert-WindowsBuildReady {
  if ($SkipLongPathCheck) { return }
  if (Get-LongPathsEnabled) { return }

  $elevated = Join-Path $ProjectRoot 'scripts\enable-windows-long-paths.ps1'
  Write-Host ''
  Write-Host '=== Build blocked: Windows long paths are OFF ===' -ForegroundColor Yellow
  Write-Host 'Native builds need long paths or they corrupt caches and hammer RAM until the PC freezes.'
  Write-Host 'Run: npm run android:long-paths  -> reboot -> npm run android:build'
  if (Test-Path $elevated) {
    try {
      Start-Process powershell.exe -Verb RunAs -ArgumentList @('-ExecutionPolicy', 'Bypass', '-File', $elevated) | Out-Null
    } catch { }
  }
  exit 1
}

function Get-FreeRamGb {
  $os = Get-CimInstance Win32_OperatingSystem
  [math]::Round($os.FreePhysicalMemory / 1MB, 1)
}

function Assert-FreeRam {
  $freeGb = Get-FreeRamGb
  Write-Host "Free RAM: ${freeGb} GB (need >= ${MinFreeRamGb} GB)"
  if ($freeGb -lt $MinFreeRamGb) {
    Write-Host ''
    Write-Host 'Not enough free RAM. Before building:' -ForegroundColor Yellow
    Write-Host '  - Close Cursor (optional but helps), Chrome, Discord, games'
    Write-Host '  - Stop Android emulator: npm run android:emu-stop'
    Write-Host '  - Retry when Task Manager shows 8+ GB free'
    exit 1
  }
}

function Stop-MemoryHogs {
  Write-Host 'Stopping emulator / Gradle / Studio processes to free RAM...'
  foreach ($procName in @('qemu-system-x86_64', 'emulator', 'studio64')) {
    Get-Process -Name $procName -ErrorAction SilentlyContinue |
      Stop-Process -Force -ErrorAction SilentlyContinue
  }
  Stop-GradleDaemons
  Start-Sleep -Seconds 2
  $free = Get-FreeRamGb
  Write-Host "Free RAM after cleanup: ${free} GB"
}

function Stop-GradleDaemons {
  $android = Join-Path $ProjectRoot 'android'
  if (Test-Path "$android\gradlew.bat") {
    Push-Location $android
    & .\gradlew.bat -g $GradleHome --stop 2>$null | Out-Null
    Pop-Location
  }
  Get-Process -Name 'java' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

function Invoke-Adb {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & $script:Adb @Args 2>&1
  $ErrorActionPreference = $prev
  return $out
}

function Get-EmulatorRamMb {
  if ($env:DEV_EMU_RAM_MB) {
    return [Math]::Max(2048, [int]$env:DEV_EMU_RAM_MB)
  }
  return 4096
}

function Get-EmulatorMemTotalKb {
  $line = Invoke-Adb shell 'grep MemTotal /proc/meminfo' 2>$null
  if ($line -match '(\d+)') { return [int]$Matches[1] }
  return 0
}

function Install-Apk([string]$ApkPath) {
  # Invoke-Adb swallows stderr into its return value, so check it explicitly —
  # `adb install` can fail (e.g. INSTALL_FAILED_*, or the device was still
  # mid-boot) while the script keeps going and reports false success.
  $out = Invoke-Adb install -r $ApkPath
  $text = ($out | Out-String)
  if ($text -notmatch 'Success') {
    Write-Host $text
    Write-Error "adb install failed. See output above."
  }
}

function Wait-ForBootCompleted {
  # adb reporting a device as "device" (vs "offline"/absent) just means the
  # daemon is reachable — on a cold boot (esp. a never-booted-before AVD, no
  # snapshot to restore) the OS/package manager can still be mid-boot for a
  # while after that, on the "FallbackHome"/setup-wizard screen. Installing or
  # launching an app in that window silently no-ops (adb reports success, but
  # nothing actually installs), so wait for the real boot-completed flag too.
  $deadline = (Get-Date).AddMinutes(4)
  do {
    $prop = (Invoke-Adb shell getprop sys.boot_completed) -join ''
    if ($prop.Trim() -eq '1') { return $true }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Start-LightEmulator {
  $emuRamMb = Get-EmulatorRamMb
  $minMemKb = [int]($emuRamMb * 0.85 * 1024)

  $ready = Invoke-Adb devices | Select-String 'emulator-\d+\s+device'
  if ($ready) {
    $memKb = Get-EmulatorMemTotalKb
    if ($memKb -gt 0 -and $memKb -lt $minMemKb) {
      Write-Host "Emulator RAM is low ($([math]::Round($memKb/1024)) MB). Restarting with ${emuRamMb} MB..."
      $emuLine = Invoke-Adb devices | Select-String 'emulator-\d+'
      if ($emuLine) {
        Invoke-Adb -s (($emuLine -split '\s+')[0]) emu kill | Out-Null
        Start-Sleep -Seconds 4
      }
      $ready = $null
    } else {
      if (-not (Wait-ForBootCompleted)) { Write-Error 'Emulator is running but never finished booting.' }
      return
    }
  }

  if (-not (Test-Path $script:Emu)) {
    Write-Error 'Install Android emulator (Pixel_6 AVD) in Android Studio.'
  }

  Write-Host "Starting emulator (software GPU, ${emuRamMb} MB RAM)..."
  # swiftshader_indirect = CPU GLES, avoids dedicated GPU VRAM spikes
  $emuArgs = @(
    '-avd', 'Pixel_6',
    '-no-snapshot-load',
    '-gpu', 'swiftshader_indirect',
    '-memory', "$emuRamMb",
    '-cores', '2',
    '-no-boot-anim',
    '-no-audio'
  )
  Start-Process -FilePath $script:Emu -ArgumentList $emuArgs -WindowStyle Minimized

  $deadline = (Get-Date).AddMinutes(6)
  do {
    Start-Sleep -Seconds 5
    $ready = Invoke-Adb devices | Select-String 'emulator-\d+\s+device'
    Write-Host 'Waiting for emulator...'
  } while (-not $ready -and (Get-Date) -lt $deadline)
  if (-not $ready) { Write-Error 'Emulator did not boot.' }

  Write-Host 'Waiting for Android to finish booting...'
  if (-not (Wait-ForBootCompleted)) { Write-Error 'Emulator started but never finished booting.' }
}

$jbr = Resolve-JavaHome
if (-not $jbr) { Write-Error 'Install Android Studio.' }
$env:JAVA_HOME = $jbr
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$env:GRADLE_USER_HOME = $GradleHome
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = $Abi
$env:CMAKE_BUILD_PARALLEL_LEVEL = '1'
$env:GRADLE_OPTS = '-Xmx1024m -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'
New-Item -ItemType Directory -Force -Path $GradleHome | Out-Null

$script:Adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$script:Emu = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'
if (-not (Test-Path $script:Adb)) { Write-Error "adb not found: $env:ANDROID_HOME" }

Write-Host '=== Local Marketplace Android (low memory mode) ===' -ForegroundColor Cyan
Write-Host 'Tip: Close Cursor during this window if the PC still struggles.'

if ($EmuOnly) {
  Assert-FreeRam
  Start-LightEmulator
  exit 0
}

if ($Clean) {
  Stop-MemoryHogs
  foreach ($rel in @('android\.gradle', 'android\build', 'android\app\build', 'android\app\.cxx')) {
    $full = Join-Path $ProjectRoot $rel
    if (Test-Path $full) { Remove-Item -Recurse -Force $full -ErrorAction SilentlyContinue }
  }
  foreach ($cxx in @(
    'node_modules\react-native-worklets\android\.cxx',
    'node_modules\react-native-reanimated\android\.cxx'
  )) {
    $full = Join-Path $ProjectRoot $cxx
    if (Test-Path $full) { Remove-Item -Recurse -Force $full -ErrorAction SilentlyContinue }
  }
  foreach ($cache in @("$env:USERPROFILE\.gradle", $GradleHome, 'C:\gradle')) {
    if (Test-Path $cache) { Remove-Item -Recurse -Force $cache -ErrorAction SilentlyContinue }
  }
  New-Item -ItemType Directory -Force -Path $GradleHome | Out-Null
  if ($CleanOnly) { Write-Host 'Clean finished.'; exit 0 }
}

if ($InstallOnly) {
  if (-not (Test-Path $ApkPath)) {
    Write-Error "No APK at $ApkPath - run a full build once: npm.cmd run android:build"
  }
  Assert-FreeRam
  Start-LightEmulator
  Install-Apk $ApkPath
  Invoke-Adb reverse tcp:8081 tcp:8081 | Out-Null
  Invoke-Adb shell am start -n com.example.localmarketplace/com.example.localmarketplace.MainActivity | Out-Null
  Write-Host 'Installed existing APK. Run: npm run start'
  exit 0
}

Assert-WindowsBuildReady
Assert-FreeRam
Stop-MemoryHogs
Assert-FreeRam

$androidDir = Join-Path $ProjectRoot 'android'
if ($Prebuild -or -not (Test-Path (Join-Path $androidDir 'gradlew.bat'))) {
  Write-Host 'expo prebuild (android)...'
  $env:NODE_OPTIONS = '--max-old-space-size=2048'
  npx expo prebuild --platform android --no-install
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
}

# Android Studio's bundled JBR crashes (EXCEPTION_ACCESS_VIOLATION in the G1 GC
# thread) during the native/Kotlin compile on this hardware. Prebuild regenerates
# gradle.properties from the RN template, so re-apply the stable JVM settings on
# every run: bigger heap + ParallelGC for the Gradle JVM, and in-process Kotlin
# compilation so no separate (crash-prone) Kotlin daemon is spawned.
$gradleProps = Join-Path $androidDir 'gradle.properties'
if (Test-Path $gradleProps) {
  $gp = Get-Content $gradleProps -Raw
  $gp = [regex]::Replace(
    $gp,
    '(?m)^org\.gradle\.jvmargs=.*$',
    'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseParallelGC -Dfile.encoding=UTF-8'
  )
  if ($gp -notmatch '(?m)^kotlin\.compiler\.execution\.strategy=') {
    $gp = $gp.TrimEnd() + "`r`n`r`n# JBR/G1 crashes the Kotlin daemon here; compile in the stabilized Gradle JVM.`r`nkotlin.compiler.execution.strategy=in-process`r`nkotlin.daemon.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+UseParallelGC`r`n"
  }
  Set-Content -Path $gradleProps -Value $gp -NoNewline
  Write-Host 'Applied JBR-stable Gradle/Kotlin JVM settings to gradle.properties.'
}

if (-not $KeepEmulatorRunning) {
  $emuLine = Invoke-Adb devices | Select-String 'emulator-\d+'
  if ($emuLine) {
    Invoke-Adb -s (($emuLine -split '\s+')[0]) emu kill | Out-Null
    Start-Sleep -Seconds 2
  }
}

Stop-GradleDaemons
Assert-FreeRam

Set-NoSpaceNdk

Write-Host "Compiling for ABI '$Abi' (Gradle 4 GB heap, ParallelGC, in-process Kotlin, emulator off)..."
$androidPath = Join-Path $ProjectRoot 'android'
Push-Location $androidPath

$gradleArgList = @(
  '-g', $GradleHome,
  '--no-daemon',
  'app:assembleDebug',
  '-x', 'lint',
  '-x', 'test',
  "-PreactNativeArchitectures=$Abi"
)
if ($Clean) { $gradleArgList += '--no-build-cache' }

# Redirect Gradle output to files so failures are visible after the run
# (Start-Process without -NoNewWindow spawns a throwaway console that hides errors).
$gradleOut = Join-Path $ProjectRoot 'android-gradle.out.log'
$gradleErr = Join-Path $ProjectRoot 'android-gradle.err.log'
Remove-Item $gradleOut, $gradleErr -ErrorAction SilentlyContinue
Write-Host "Gradle output -> $gradleOut"
Write-Host "Gradle errors -> $gradleErr"

# Runs gradlew.bat directly (not via Start-Process -PassThru) because on Windows
# PowerShell 5.1, Start-Process's returned ExitCode is unreliable when combined with
# -RedirectStandardOutput/-RedirectStandardError: it has been observed reporting a
# build as failed (empty/non-zero $proc.ExitCode) even though Gradle printed "BUILD
# SUCCESSFUL" and produced a real APK on disk. A direct call's $LASTEXITCODE is reliable.
& .\gradlew.bat @gradleArgList 1> $gradleOut 2> $gradleErr
$gradleExit = $LASTEXITCODE

Pop-Location

if ($gradleExit -ne 0) {
  Write-Host ''
  Write-Host "=== Gradle FAILED (exit $gradleExit) - last 60 lines ===" -ForegroundColor Red
  if (Test-Path $gradleOut) { Get-Content $gradleOut -Tail 60 }
  if (Test-Path $gradleErr) { Get-Content $gradleErr -Tail 60 }
  Write-Error "Gradle failed ($gradleExit). See android-gradle.out.log / android-gradle.err.log. Try: npm run android:clean then npm run android:build"
}

if (-not (Test-Path $ApkPath)) { Write-Error ('APK missing: ' + $ApkPath) }

if ($Device -or $Abi -ne 'x86_64') {
  # Built for a physical device; the local emulator is x86_64, so don't try to
  # install there. The user sideloads the APK over Wi-Fi/USB instead.
  Write-Host ''
  Write-Host "Success. APK ($Abi) ready: $ApkPath" -ForegroundColor Green
  Write-Host 'Install it on your phone, then run: npm run start:lan'
  exit 0
}

Write-Host 'Compile done. Starting light emulator...'
Start-LightEmulator

Install-Apk $ApkPath
Invoke-Adb reverse tcp:8081 tcp:8081 | Out-Null
Invoke-Adb shell am force-stop com.example.localmarketplace | Out-Null
Invoke-Adb shell am start -n com.example.localmarketplace/com.example.localmarketplace.MainActivity | Out-Null

Write-Host ''
Write-Host 'Success. You can close this window.' -ForegroundColor Green
Write-Host 'In a normal terminal (or re-open Cursor): npm run start'
