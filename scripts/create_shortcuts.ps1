# scripts/create_shortcuts.ps1
# Cria atalhos na Area de Trabalho e na pasta raiz do projeto

$wsh = New-Object -ComObject WScript.Shell

$exePath = "C:\Users\Usuario\.gemini\antigravity-ide\scratch\downvideo\dist\DownVideo Studio-win32-x64\DownVideo Studio.exe"
$workDir = "C:\Users\Usuario\.gemini\antigravity-ide\scratch\downvideo\dist\DownVideo Studio-win32-x64"
$iconPath = "C:\Users\Usuario\.gemini\antigravity-ide\scratch\downvideo\assets\icon.ico"
$desc = "DownVideo Studio - Baixador de Videos, Compactador e Gerenciador de SSD"

# 1. Atalho na Area de Trabalho (Desktop)
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcutPath = Join-Path $desktopPath "DownVideo Studio.lnk"

$s1 = $wsh.CreateShortcut($desktopShortcutPath)
$s1.TargetPath = $exePath
$s1.WorkingDirectory = $workDir
$s1.IconLocation = "$iconPath,0"
$s1.Description = $desc
$s1.Save()
Write-Output "Atalho criado com sucesso na Area de Trabalho: $desktopShortcutPath"

# 2. Atalho na pasta raiz do projeto
$rootShortcutPath = "C:\Users\Usuario\.gemini\antigravity-ide\scratch\downvideo\DownVideo Studio.lnk"
$s2 = $wsh.CreateShortcut($rootShortcutPath)
$s2.TargetPath = $exePath
$s2.WorkingDirectory = $workDir
$s2.IconLocation = "$iconPath,0"
$s2.Description = $desc
$s2.Save()
Write-Output "Atalho criado com sucesso na pasta raiz: $rootShortcutPath"
