# Run as Administrator once, then reboot. Required for React Native Android builds on Windows.
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Write-Host 'Requesting Administrator approval...'
  $self = $MyInvocation.MyCommand.Path
  Start-Process powershell.exe -Verb RunAs -ArgumentList @('-ExecutionPolicy', 'Bypass', '-File', $self)
  exit 0
}

reg add 'HKLM\SYSTEM\CurrentControlSet\Control\FileSystem' /v LongPathsEnabled /t REG_DWORD /d 1 /f
Write-Host ''
Write-Host 'LongPathsEnabled = 1' -ForegroundColor Green
Write-Host 'REBOOT Windows, then run:  npm run android:build'
Write-Host ''
