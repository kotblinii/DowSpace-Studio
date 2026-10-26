# scripts/install.ps1
# Instalador Automatizado do DowSpace Studio para Windows

param(
    $Silent = $false,
    $LaunchAfter = $true
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      DowSpace Studio - Instalador para Windows           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$sourceDir = Join-Path $PSScriptRoot "..\dist\DownVideo Studio-win32-x64"
$installDir = Join-Path $env:LOCALAPPDATA "DowSpace Studio"
$exeName = "DownVideo Studio.exe"
$targetExe = Join-Path $installDir $exeName
$iconPath = Join-Path $installDir "assets\icon.ico"

# 1. Verifica se a build existe, caso contrário executa npm run build
if (-not (Test-Path (Join-Path $sourceDir $exeName))) {
    Write-Host "[1/5] Executavel compilado nao encontrado. Compilando o aplicativo agora..." -ForegroundColor Yellow
    $rootPath = Join-Path $PSScriptRoot ".."
    $buildResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm.cmd run build" -WorkingDirectory $rootPath -Wait -PassThru
    if ($buildResult.ExitCode -ne 0) {
        Write-Error "Falha ao compilar o executavel com npm run build."
        exit 1
    }
}

# 2. Fecha processos existentes se estiver aberto
Write-Host "[2/5] Verificando se o DowSpace Studio esta em execucao..." -ForegroundColor White
Get-Process -Name "*DownVideo Studio*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

# 3. Cria a pasta de destino e copia os arquivos
Write-Host "[3/5] Instalando arquivos em: $installDir" -ForegroundColor White
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Copiar arquivos
robocopy "$sourceDir" "$installDir" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

# Copiar pasta assets se existir na raiz
$rootAssets = Join-Path $PSScriptRoot "..\assets"
$destAssets = Join-Path $installDir "assets"
if (Test-Path $rootAssets) {
    if (-not (Test-Path $destAssets)) { New-Item -ItemType Directory -Path $destAssets -Force | Out-Null }
    Copy-Item -Path "$rootAssets\*" -Destination $destAssets -Recurse -Force | Out-Null
}

# 4. Criar atalhos (Desktop e Menu Iniciar)
Write-Host "[4/5] Criando atalhos na Area de Trabalho e no Menu Iniciar..." -ForegroundColor White
$wsh = New-Object -ComObject WScript.Shell

# Desktop
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = Join-Path $desktopPath "DowSpace Studio.lnk"
$s1 = $wsh.CreateShortcut($desktopShortcut)
$s1.TargetPath = $targetExe
$s1.WorkingDirectory = $installDir
if (Test-Path $iconPath) {
    $s1.IconLocation = "$iconPath,0"
} else {
    $s1.IconLocation = "$targetExe,0"
}
$s1.Description = "DowSpace Studio - Baixador, Compactador e Gerenciador de SSD"
$s1.Save()

# Start Menu
$startMenuPath = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"
$startMenuShortcut = Join-Path $startMenuPath "DowSpace Studio.lnk"
$s2 = $wsh.CreateShortcut($startMenuShortcut)
$s2.TargetPath = $targetExe
$s2.WorkingDirectory = $installDir
if (Test-Path $iconPath) {
    $s2.IconLocation = "$iconPath,0"
} else {
    $s2.IconLocation = "$targetExe,0"
}
$s2.Description = "DowSpace Studio - Baixador, Compactador e Gerenciador de SSD"
$s2.Save()

# 5. Criar Desinstalador e Registrar no Windows
Write-Host "[5/5] Registrando o aplicativo no Painel do Windows..." -ForegroundColor White

$uninstallerScript = @"
# Desinstalador do DowSpace Studio
Get-Process -Name "*DownVideo Studio*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

`$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "DowSpace Studio.lnk"
`$startMenuShortcut = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\DowSpace Studio.lnk"

if (Test-Path `$desktopShortcut) { Remove-Item `$desktopShortcut -Force }
if (Test-Path `$startMenuShortcut) { Remove-Item `$startMenuShortcut -Force }

Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DowSpaceStudio" -Recurse -Force -ErrorAction SilentlyContinue

`$installPath = "$installDir"
# Agendar remocao do diretorio apos fechar o powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c ping 127.0.0.1 -n 2 > nul & rmdir /s /q `"`$installPath`"" -WindowStyle Hidden
Write-Host "DowSpace Studio foi desinstalado com sucesso." -ForegroundColor Green
"@
$uninstallPs1Path = Join-Path $installDir "uninstall.ps1"
Set-Content -Path $uninstallPs1Path -Value $uninstallerScript -Encoding UTF8

$uninstallerBat = @"
@echo off
title Desinstalando DowSpace Studio...
powershell -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
"@
Set-Content -Path (Join-Path $installDir "desinstalar.bat") -Value $uninstallerBat -Encoding ASCII

# Registro no Windows (Configuracoes > Aplicativos Instalados)
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DowSpaceStudio"
if (-not (Test-Path $regKey)) {
    New-Item -Path $regKey -Force | Out-Null
}
Set-ItemProperty -Path $regKey -Name "DisplayName" -Value "DowSpace Studio"
Set-ItemProperty -Path $regKey -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $regKey -Name "Publisher" -Value "kotblinii"
Set-ItemProperty -Path $regKey -Name "DisplayIcon" -Value "$targetExe,0"
Set-ItemProperty -Path $regKey -Name "InstallLocation" -Value $installDir
Set-ItemProperty -Path $regKey -Name "UninstallString" -Value "powershell.exe -ExecutionPolicy Bypass -File `"$uninstallPs1Path`""

Write-Host ""
Write-Host "----------------------------------------------------------" -ForegroundColor Green
Write-Host " [SUCESSO] O DowSpace Studio foi instalado com sucesso!" -ForegroundColor Green
Write-Host " - Destino: $installDir" -ForegroundColor White
Write-Host " - Atalho: Area de Trabalho & Menu Iniciar" -ForegroundColor White
Write-Host "----------------------------------------------------------" -ForegroundColor Green
Write-Host ""

if ($LaunchAfter -and -not $Silent) {
    Write-Host "Iniciando o aplicativo..." -ForegroundColor Cyan
    Start-Process -FilePath $targetExe -WorkingDirectory $installDir
}
