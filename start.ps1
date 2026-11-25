$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path node_modules)) { & npm.cmd ci; if ($LASTEXITCODE) { throw 'npm ci failed' } }
if (!(Test-Path web/public/model/assembly.json)) { & npm.cmd run convert; if ($LASTEXITCODE) { throw 'STEP conversion failed' } }
& npm.cmd run build
if ($LASTEXITCODE) { throw 'Frontend build failed' }
& dotnet build src/Robot.Desktop -c Release
if ($LASTEXITCODE) { throw 'Desktop build failed' }
Start-Process -FilePath (Join-Path $PSScriptRoot 'src/Robot.Desktop/bin/Release/net10.0-windows/Robot.Desktop.exe')
