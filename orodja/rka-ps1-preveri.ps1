$ErrorActionPreference = 'Stop'
$dir = if ($args.Count -gt 0) { $args[0] } else { 'C:\Users\admin\Downloads\sssdf\rka-onepage\orodja' }
$napake = 0
$stevec = 0
foreach ($f in (Get-ChildItem -Path $dir -Filter *.ps1 | Sort-Object Name)) {
  $stevec++
  $tokens = $null; $erros = $null
  [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$erros) | Out-Null
  if ($erros.Count -gt 0) {
    $napake++
    Write-Output ("PARSING FAILED: " + $f.Name + " -> " + $erros[0].Message)
  } else {
    Write-Output ("parses ok: " + $f.Name)
  }
}
Write-Output ("ps1 files: " + $stevec + " | parsing errors: " + $napake)
if ($napake -gt 0) { exit 1 }
