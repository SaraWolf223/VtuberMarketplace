# Quick Android dev environment report (run: npm run android:doctor)
$ErrorActionPreference = 'SilentlyContinue'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$GradleHome = 'C:\g'
$Apk = Join-Path $ProjectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'

Write-Host '=== Local Marketplace Android doctor ===' -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot ($($ProjectRoot.Length) chars)"
Write-Host ''

$lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled).LongPathsEnabled
if ($lp -eq 1) {
  Write-Host '[OK] Windows long paths: ON' -ForegroundColor Green
} else {
  Write-Host '[FAIL] Windows long paths: OFF' -ForegroundColor Red
  Write-Host '       Fix: Admin CMD: reg add HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled /t REG_DWORD /d 1 /f' -ForegroundColor Yellow
  Write-Host '       Then REBOOT. Or run scripts\enable-windows-long-paths.bat as Administrator.' -ForegroundColor Yellow
}

$os = Get-CimInstance Win32_OperatingSystem
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$totalGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$ramOk = $freeGb -ge 8
Write-Host "$(if ($ramOk) { '[OK]' } else { '[WARN]' }) RAM: ${freeGb} GB free / ${totalGb} GB total (need ~8 GB free to compile)"

Write-Host "$(if (Test-Path (Join-Path $ProjectRoot 'android\gradlew.bat')) { '[OK]' } else { '[FAIL]' }) android/ native project"
Write-Host "$(if (Test-Path $Apk) { '[OK]' } else { '[MISS]' }) debug APK: $Apk"

$jbr = @(
  'C:\Program Files\Android\Android Studio\jbr',
  "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"
) | Where-Object { Test-Path "$_\bin\java.exe" } | Select-Object -First 1
Write-Host "$(if ($jbr) { '[OK]' } else { '[FAIL]' }) Java (Android Studio JBR): $(if ($jbr) { $jbr } else { 'not found' })"

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
Write-Host "$(if (Test-Path "$sdk\platform-tools\adb.exe") { '[OK]' } else { '[FAIL]' }) ANDROID_HOME: $sdk"

$procs = @(Get-Process -Name java, emulator, qemu-system-x86_64, studio64 -ErrorAction SilentlyContinue)
if ($procs.Count -gt 0) {
  Write-Host '[INFO] Heavy processes (consider npm run android:emu-stop):' -ForegroundColor Yellow
  $procs | ForEach-Object { Write-Host "       $($_.Name) $([math]::Round($_.WorkingSet64/1MB)) MB" }
} else {
  Write-Host '[OK] No emulator / Gradle java hogging RAM'
}

if (Test-Path $GradleHome) {
  $longest = Get-ChildItem $GradleHome -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object { $_.FullName.Length } -Descending |
    Select-Object -First 1
  if ($longest) {
    $len = $longest.FullName.Length
    $pathOk = $len -le 260 -or $lp -eq 1
    Write-Host "$(if ($pathOk) { '[OK]' } else { '[FAIL]' }) Longest Gradle cache path: $len chars"
    if (-not $pathOk) { Write-Host "       $($longest.FullName)" }
  }
}

Write-Host ''
Write-Host 'Recommended workflow:' -ForegroundColor Cyan
if ($lp -ne 1) {
  Write-Host '  1. Enable long paths (ADMIN) + REBOOT — build will NOT run until then'
} elseif (-not (Test-Path $Apk)) {
  Write-Host '  1. npm.cmd run android:build  (separate blue window)'
} else {
  Write-Host '  1. npm.cmd run start && npm.cmd run android:install'
}
if ($lp -eq 1 -and -not (Test-Path $Apk)) {
  Write-Host '  2. npm.cmd run start  after build finishes'
}
Write-Host '  3. npm run android:emu-stop  when PC feels slow'
