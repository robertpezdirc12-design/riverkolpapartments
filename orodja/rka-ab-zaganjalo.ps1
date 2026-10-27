$napake = $null
$dat = Join-Path $env:TEMP "rka-ab-opazovalec.ps1"
[void][System.Management.Automation.Language.Parser]::ParseFile($dat, [ref]$null, [ref]$napake)
if ($napake.Count -ne 0) {
  Write-Output ("SINTAKSA: " + $napake.Count + " NAPAK - opazovalec NI zagnan")
  foreach ($n in $napake) { Write-Output ("  " + $n.Extent.StartLineNumber + ": " + $n.Message) }
  exit 1
}
$p = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$dat`"") `
  -WindowStyle Hidden -PassThru
Write-Output ("SINTAKSA OPAZOVALCA: V REDU, PID=" + $p.Id)
Set-Content -LiteralPath ((Join-Path $env:TEMP "rka-ab-opazovalec.ps1") + ".pid") -Value $p.Id -Encoding ascii
