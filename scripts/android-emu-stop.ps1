# Free RAM/VRAM — stop emulator and Gradle.
$ErrorActionPreference = 'SilentlyContinue'
$android = Join-Path (Split-Path $PSScriptRoot -Parent) 'android'
if (Test-Path "$android\gradlew.bat") {
  Push-Location $android
  & .\gradlew.bat -g C:\g --stop 2>$null
  Pop-Location
}
foreach ($n in @('qemu-system-x86_64', 'emulator', 'java', 'studio64')) {
  Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force
}
Write-Host 'Emulator and Gradle stopped.'
