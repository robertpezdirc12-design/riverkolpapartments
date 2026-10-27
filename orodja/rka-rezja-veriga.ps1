# Detached render chain: 8 canvases, then the gates that depend on them.
# Journal and per-step logs stay ASCII-only on purpose: this file is launched
# without a console, so a diacritic written through the wrong codepage would
# silently corrupt the evidence it is meant to protect.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
# PowerShell 5.1 decodes the output of native commands with [Console]::OutputEncoding,
# which is cp1250 here. The Slovene verdict lines of the gates therefore landed in the
# saved logs as mojibake (the caron came out as two box-drawing characters) - and
# the saved log is the evidence.
$UTF8 = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = $UTF8
[Console]::InputEncoding = $UTF8
$TEMP = $env:TEMP
$DNEVNIK = Join-Path $TEMP "rezja-dnevnik.txt"
$RENDER = Join-Path $TEMP "rka-render.cjs"
$NODE = "C:\Program Files\nodejs\node.exe"
$PY = "C:\Program Files\Python311\python.exe"
Set-Location $TEMP

function Vpis([string]$s) {
  Add-Content -LiteralPath $DNEVNIK -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $s) -Encoding ascii
}

function Test-VrataBusy([int]$p) {
  $vzorec = "^\s+TCP\s+\S+:" + $p + "\s+\S+\s+LISTENING"
  return [bool](netstat -ano | Select-String -Pattern $vzorec)
}

function Cakaj-ProstaVrata([int]$p, [int]$maxSek) {
  $kon = (Get-Date).AddSeconds($maxSek)
  while (Test-VrataBusy $p) {
    if ((Get-Date) -gt $kon) { return $false }
    Start-Sleep -Milliseconds 800
  }
  return $true
}

function Korak([string]$ime, [string]$exe, [string[]]$parametri, [int]$ck) {
  $log = Join-Path $TEMP ("rezja-" + $ime + ".log")
  if ($ck -gt 0) {
    if (-not (Cakaj-ProstaVrata $ck 120)) {
      Vpis ("preskocen " + $ime + ": vrata " + $ck + " se ne sprostijo (CK=1)")
      return 90
    }
  }
  Vpis ("zagon " + $ime)
  & $exe @parametri 2>&1 | Out-File -LiteralPath $log -Encoding utf8
  $koda = $LASTEXITCODE
  Vpis ("izhod " + $ime + " = " + $koda)
  return $koda
}

Vpis "=== VERIGE ZAGON (8 rezij + 9 preverb) ==="
$rezije = @(
  @{ tag = "60-sl-16x9"; a = @("60", "--jezik=sl") },
  @{ tag = "60-en-16x9"; a = @("60", "--jezik=en") },
  @{ tag = "30-sl-16x9"; a = @("30", "--jezik=sl") },
  @{ tag = "30-en-16x9"; a = @("30", "--jezik=en") },
  @{ tag = "60-sl-9x16"; a = @("60", "--jezik=sl", "--razmerje=9x16") },
  @{ tag = "60-en-9x16"; a = @("60", "--jezik=en", "--razmerje=9x16") },
  @{ tag = "30-sl-9x16"; a = @("30", "--jezik=sl", "--razmerje=9x16") },
  @{ tag = "30-en-9x16"; a = @("30", "--jezik=en", "--razmerje=9x16") }
)
foreach ($r in $rezije) {
  $k = Korak ("render-" + $r.tag) $NODE (@($RENDER) + $r.a) 9411
  if ($k -ne 0) {
    Vpis ("VERIGA USTAVLJENA: render " + $r.tag + " koda=" + $k + ", preveri se ne izvedejo")
    Vpis "=== KONEC VERIGE (poraz) ==="
    exit 1
  }
}

$preveri = @(
  @{ tag = "izvoz"; exe = $PY; a = @("rka-izvoz-preveri.py") },
  @{ tag = "podnapisi"; exe = $PY; a = @("rka-podnapisi-preveri.py") },
  @{ tag = "podnapisi-mutacija"; exe = $PY; a = @("rka-podnapisi-mutacija.py") },
  @{ tag = "gib-sonda"; exe = $NODE; a = @("rka-gib-sonda.cjs") },
  @{ tag = "gib-mutacija"; exe = $PY; a = @("rka-gib-mutacija.py") },
  @{ tag = "pokonci-sonda"; exe = $NODE; a = @("rka-pokonci-sonda.cjs") },
  @{ tag = "pokonci-mutacija"; exe = $PY; a = @("rka-pokonci-mutacija.py") },
  @{ tag = "zgodba-sonda"; exe = $NODE; a = @("rka-zgodba-sonda.cjs") },
  @{ tag = "vednost"; exe = $PY; a = @("rka-vednost-preveri.py") }
)
foreach ($p in $preveri) {
  $null = Korak $p.tag $p.exe $p.a 0
}
Vpis "=== KONEC VERIGE ==="
