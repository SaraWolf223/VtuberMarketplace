# Starts the Android build in a NEW window so Cursor does not absorb 4–8 GB RAM/VRAM.
param(
  [switch]$Clean,
  [switch]$CleanOnly,
  [switch]$EmuOnly,
  [switch]$Prebuild,
  [switch]$InstallOnly,
  [switch]$KeepEmulatorRunning,
  [switch]$Device,
  [string]$Abi = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$devScript = Join-Path $ProjectRoot 'scripts\android-dev.ps1'
$logPath = Join-Path $ProjectRoot 'android-build.log'

# Build the dev-script flag string passed through to android-dev.ps1.
$flags = @('-InProcess')
if ($Clean) { $flags += '-Clean' }
if ($CleanOnly) { $flags += '-CleanOnly' }
if ($EmuOnly) { $flags += '-EmuOnly' }
if ($Prebuild) { $flags += '-Prebuild' }
if ($InstallOnly) { $flags += '-InstallOnly' }
if ($KeepEmulatorRunning) { $flags += '-KeepEmulatorRunning' }
if ($Device) { $flags += '-Device' }
if ($Abi) { $flags += @('-Abi', $Abi) }

# Run in a new window AND tee all output to android-build.log so progress/errors
# can be inspected without watching the window. The log is gitignored.
$inner = "& '$devScript' $($flags -join ' ') *>&1 | Tee-Object -FilePath '$logPath'"
$argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $inner)

Write-Host 'Opening Android build in a separate window (keeps Cursor RAM/VRAM low)...' -ForegroundColor Cyan
Write-Host "Close browsers and games before building. Watch the blue PowerShell window for progress."
Write-Host "Output is also logged to: $logPath"

Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -WorkingDirectory $ProjectRoot -WindowStyle Normal
