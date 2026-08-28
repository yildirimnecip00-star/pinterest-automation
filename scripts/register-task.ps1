param(
  [string]$Time = "09:00"
)
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Error "node.exe PATH'te bulunamadi. Node.js kurulumunu tamamlayip yeni bir terminal ac."
  exit 1
}

$action = New-ScheduledTaskAction -Execute $nodeCmd.Source -Argument "src\index.js" -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 6)

Register-ScheduledTask `
  -TaskName "AnatolianKilimHomePinterest" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Etsy ilanlarini (pillow/mini-rug/rug) gunluk olarak Pinterest'e otomatik pinler" `
  -Force

Write-Host "Kuruldu. Her gun $Time civarinda 'node src\index.js' calisacak (PC o saatte kapaliysa, acildiginda telafi calisir)."
Write-Host "NOT: GitHub Actions kullaniyorsan bu goreve gerek yok - pin.yml zaten bulutta calisiyor."
Write-Host "Kontrol/kaldirmak icin: Windows 'Gorev Zamanlayicisi' -> 'AnatolianKilimHomePinterest'."
