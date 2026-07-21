# Start Metro if needed, reverse port 8081, open Local Marketplace dev client on the emulator.
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$Adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"

if (-not (Test-Path $Adb)) {
  Write-Error "adb not found. Set ANDROID_HOME or install Android SDK platform-tools."
}

$devices = & $Adb devices | Select-String "emulator-\d+\s+device"
if (-not $devices) {
  Write-Error "No Android emulator running. Start Pixel_6 from Android Studio Device Manager first."
}

$metroUp = $false
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -TimeoutSec 5 -UseBasicParsing
  $metroUp = $r.Content -match "running"
} catch {
  $metroUp = $false
}

if (-not $metroUp) {
  Write-Host "Metro not running on 8081 - start it in another terminal: npm run start"
  Write-Host "Then run this script again, or press a in the Metro terminal."
  exit 1
}

& $Adb reverse tcp:8081 tcp:8081 | Out-Null
& $Adb shell am force-stop com.example.localmarketplace | Out-Null
& $Adb shell am start -n com.example.localmarketplace/.MainActivity
Write-Host "Opened Local Marketplace (Metro via adb reverse on localhost:8081)"
