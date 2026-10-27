# Detached launcher: the chain outlives this console, its journal is the only
# witness, so it is started as an independent process instead of a child.
$veriga = Join-Path $env:TEMP "rka-rezja-veriga.ps1"
$p = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$veriga`"") `
  -WindowStyle Hidden -PassThru
Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-Command", "`"Set-Content -LiteralPath '$($veriga).pid' -Value '$($p.Id)'`"") `
  -WindowStyle Hidden -Wait
Write-Output ("ZAGONJENO PID=" + $p.Id)
