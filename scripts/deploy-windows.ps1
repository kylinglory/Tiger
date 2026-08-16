$ErrorActionPreference = 'Stop'
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$AppDir = 'C:\apps\xiaojishuo-api'
$ToolsDir = 'C:\tools'
$CaddyDir = Join-Path $ToolsDir 'caddy'
$TempDir = Join-Path $env:TEMP ('xiaojishuo-deploy-' + [guid]::NewGuid().ToString('N'))
$RepoZip = Join-Path $TempDir 'repo.zip'
$RepoUrl = 'https://github.com/kylinglory/my-website/archive/refs/heads/main.zip'
$NodeMsi = Join-Path $TempDir 'node-v18.20.4-x64.msi'
$NodeUrl = 'https://nodejs.org/dist/v18.20.4/node-v18.20.4-x64.msi'
$CaddyZip = Join-Path $TempDir 'caddy.zip'
$CaddyUrl = 'https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_windows_amd64.zip'

function Write-Step($Message) {
  Write-Host ''
  Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Download-File($Url, $Path) {
  $wc = New-Object System.Net.WebClient
  $wc.DownloadFile($Url, $Path)
}

function Ensure-ZipSupport {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
}

function Expand-Zip($ZipPath, $Destination) {
  Ensure-ZipSupport
  if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Destination)
}

function Ensure-FirewallRule($Name, $Ports) {
  try {
    if (-not (Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName $Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Ports | Out-Null
    }
  } catch {
    netsh advfirewall firewall add rule name="$Name" dir=in action=allow protocol=TCP localport=$Ports | Out-Null
  }
}

function Stop-PortProcess($Port) {
  $lines = netstat -ano | Select-String (':' + $Port + '\s')
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
    $pidText = $parts[-1]
    $pidNum = 0
    if ([int]::TryParse($pidText, [ref]$pidNum) -and $pidNum -gt 0) {
      try { Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

New-Item -ItemType Directory -Force -Path $AppDir, $ToolsDir, $CaddyDir, $TempDir | Out-Null

Write-Step 'Checking Node.js'
$nodeExe = 'C:\Program Files\nodejs\node.exe'
$npmCmd = 'C:\Program Files\nodejs\npm.cmd'
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and -not (Test-Path $nodeExe)) {
  Write-Step 'Installing Node.js 18 LTS'
  Download-File $NodeUrl $NodeMsi
  $p = Start-Process msiexec.exe -ArgumentList "/i `"$NodeMsi`" /qn /norestart" -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "Node.js installer failed with exit code $($p.ExitCode)" }
}
$env:Path = 'C:\Program Files\nodejs;' + $env:Path

Write-Step 'Downloading website backend code'
Download-File $RepoUrl $RepoZip
$ExtractDir = Join-Path $TempDir 'repo'
Expand-Zip $RepoZip $ExtractDir
$SourceDir = Get-ChildItem $ExtractDir -Directory | Select-Object -First 1
if (-not $SourceDir) { throw 'Repository zip extraction failed.' }
Copy-Item (Join-Path $SourceDir.FullName '*') $AppDir -Recurse -Force

Write-Step 'Preparing environment file'
$EnvFile = Join-Path $AppDir '.env'
if (Test-Path $EnvFile) {
  $existingEnv = Get-Content $EnvFile -Raw
} else {
  $secure = Read-Host 'Paste XIAOJI_API_KEY, then press Enter' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $existingEnv = @(
    "XIAOJI_API_KEY=$apiKey"
    'XIAOJI_API_BASE=https://xiaoji.baziapi.site/v1'
    'PORT=8787'
    'NODE_ENV=production'
    'ALLOWED_ORIGINS=https://kylinglory.com,https://www.kylinglory.com'
  ) -join "`r`n"
}
$appUser = Read-Host 'Set website login username'
$securePassword = Read-Host 'Set website login password' -AsSecureString
$bstrPassword = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstrPassword) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrPassword) }
$secretBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RNGCryptoServiceProvider]::Create()
try { $rng.GetBytes($secretBytes) }
finally { $rng.Dispose() }
$sessionSecret = [Convert]::ToBase64String($secretBytes)
$cleanEnv = $existingEnv `
  -replace '(?m)^APP_USERNAME=.*\r?\n?', '' `
  -replace '(?m)^APP_PASSWORD=.*\r?\n?', '' `
  -replace '(?m)^APP_SESSION_SECRET=.*\r?\n?', '' `
  -replace '(?m)^NODE_ENV=.*\r?\n?', '' `
  -replace '(?m)^ALLOWED_ORIGINS=.*\r?\n?', ''
@(
  $cleanEnv.Trim()
  'NODE_ENV=production'
  'ALLOWED_ORIGINS=https://kylinglory.com,https://www.kylinglory.com,https://api.kylinglory.com'
  "APP_USERNAME=$appUser"
  "APP_PASSWORD=$appPassword"
  "APP_SESSION_SECRET=$sessionSecret"
) | Where-Object { $_ } | Set-Content -Encoding UTF8 $EnvFile

Write-Step 'Installing dependencies and building private frontend'
Push-Location $AppDir
& $npmCmd install --no-audit --no-fund
& $npmCmd run build
& $npmCmd prune --omit=dev --no-audit --no-fund
Pop-Location

Write-Step 'Configuring startup task for API'
$StartApi = Join-Path $AppDir 'start-api.ps1'
@"
Set-Location '$AppDir'
`$env:NODE_ENV='production'
& '$npmCmd' start *> '$AppDir\api.log'
"@ | Set-Content -Encoding UTF8 $StartApi
Stop-PortProcess 8787
schtasks /Create /TN "XiaojishuoImageApi" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$StartApi`"" /SC ONSTART /RL HIGHEST /F | Out-Null
Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$StartApi`"" -WindowStyle Hidden

Write-Step 'Installing and configuring Caddy reverse proxy'
$CaddyExe = Join-Path $CaddyDir 'caddy.exe'
if (-not (Test-Path $CaddyExe)) {
  Download-File $CaddyUrl $CaddyZip
  Expand-Zip $CaddyZip $CaddyDir
}
$Caddyfile = Join-Path $CaddyDir 'Caddyfile'
@"
kylinglory.com, www.kylinglory.com, api.kylinglory.com {
  reverse_proxy 127.0.0.1:8787
}
"@ | Set-Content -Encoding ASCII $Caddyfile
Ensure-FirewallRule 'Xiaojishuo API HTTP HTTPS' '80,443'
Ensure-FirewallRule 'Xiaojishuo API Local Port 8787' '8787'
Stop-PortProcess 80
Stop-PortProcess 443
schtasks /Create /TN "CaddyApiProxy" /TR "`"$CaddyExe`" run --config `"$Caddyfile`" --adapter caddyfile" /SC ONSTART /RL HIGHEST /F | Out-Null
Start-Process $CaddyExe -ArgumentList "run --config `"$Caddyfile`" --adapter caddyfile" -WorkingDirectory $CaddyDir -WindowStyle Hidden

Write-Step 'Local health check'
Start-Sleep -Seconds 3
$health = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8787/api/health'
Write-Host $health.Content
Write-Host ''
Write-Host 'DONE: private website is running on http://127.0.0.1:8787 and proxied by kylinglory.com / api.kylinglory.com when DNS/security group are ready.' -ForegroundColor Green
