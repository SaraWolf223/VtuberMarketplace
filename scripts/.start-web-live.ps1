Set-Location -LiteralPath 'C:\Users\WORKPC 2\Desktop\Local MarketPlace'
$env:EXPO_NO_TELEMETRY = '1'
& 'C:\Program Files\nodejs\npx.cmd' expo start --web --port 8081 --localhost *> 'scripts\.web-live.combined.log'
