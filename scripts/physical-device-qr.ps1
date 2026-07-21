# Regenerate LAN QR for physical device testing (Metro must use npm run start:lan).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js required.'
}

node scripts/expo-qr.mjs 8081

$png = Join-Path $root 'expo-qr.png'
if (Test-Path $png) {
  Start-Process $png
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '=== Physical device setup ===' -ForegroundColor Cyan
Write-Host "Metro URL:  exp://${ip}:8081"
Write-Host "QR file:    $png"
Write-Host ''
Write-Host 'Android phone:' -ForegroundColor Yellow
Write-Host '  1. npm run start:lan   (keep terminal open)'
Write-Host '  2. Install debug APK (once): npm run android:build'
Write-Host '     Then: adb install -r android\app\build\outputs\apk\debug\app-debug.apk'
Write-Host '  3. Same Wi-Fi as PC. Open Local Marketplace app (or scan QR in Expo Go for limited test).'
Write-Host ''
Write-Host 'iPhone:' -ForegroundColor Yellow
Write-Host '  1. npm install -g eas-cli && eas login'
Write-Host '  2. eas device:create   (register iPhone)'
Write-Host '  3. npm run eas:build:preview:ios'
Write-Host '  4. Install from link in Safari (not this QR — that is for Metro/Expo Go).'
Write-Host ''
