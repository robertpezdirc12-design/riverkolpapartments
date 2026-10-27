# Watcher: runs the pixel A/B and its falsification harness once the render
# chain has printed its end marker. Deliberately waits for SUCCESS only: if the
# chain aborted, comparing half-re-rendered products would produce a green that
# means nothing.
$ErrorActionPreference = "Continue"
# PowerShell 5.1 decoding output of native commands with [Console]::OutputEncoding
# (cp1250 here). Without this line Slovene text from python arrives as mojibake in
# the saved log, which is the evidence itself.
$UTF8 = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = $UTF8
[Console]::InputEncoding = $UTF8
# $TEMP is not a PowerShell variable (only $env:TEMP is). Leaving it unassigned
# made Set-Location and Out-File's -LiteralPath fail, which aborted the pipeline
# before python ever started and wrote an empty exit code into the journal.
$TEMP = $env:TEMP
$DNEVNIK = Join-Path $env:TEMP "rezja-dnevnik.txt"
$AB_DNEVNIK = Join-Path $env:TEMP "rezja-ab-dnevnik.txt"
$PY = "C:\Program Files\Python311\python.exe"
Set-Location $TEMP

function Vpis([string]$s) {
  Add-Content -LiteralPath $AB_DNEVNIK -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $s) -Encoding ascii
}

$rok = (Get-Date).AddHours(9)
$gotovo = $false
while ((Get-Date) -lt $rok) {
  if (Test-Path -LiteralPath $DNEVNIK) {
    $vsebina = Get-Content -LiteralPath $DNEVNIK -Raw
    if ($vsebina -match "VERIGA USTAVLJENA") {
      Vpis "veriga padla: slikovni A/B se NE izvede (polovica platn bi dala lazen zeleni port)"
      exit 2
    }
    if ($vsebina -match "=== KONEC VERIGE ===") { $gotovo = $true; break }
  }
  Start-Sleep -Seconds 60
}
if (-not $gotovo) { Vpis "casovnica potekla: KONEC VERIGE ni bil zapisan v 9 urah"; exit 3 }

Vpis "veriga koncana: zaganjam slikovni A/B"
& $PY "rka-slikovni-ab.py" 2>&1 | Out-File -LiteralPath (Join-Path $TEMP "rezja-slikovni-ab.log") -Encoding utf8
Vpis ("izhod rka-slikovni-ab.py = " + $LASTEXITCODE)
& $PY "rka-slikovni-ab-mutacija.py" 2>&1 | Out-File -LiteralPath (Join-Path $TEMP "rezja-slikovni-ab-mutacija.log") -Encoding utf8
Vpis ("izhod rka-slikovni-ab-mutacija.py = " + $LASTEXITCODE)
Vpis "=== KONEC A/B OBSARVALCA ==="
