$upr = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -match 'cdp-ozadje|cdp-podnapisi|cdp-render' }
"skupaj procesov: $($upr.Count)"
$poimenovani = $upr | ForEach-Object {
  $ime = ""
  if ($_.CommandLine -match '--user-data-dir=([^ ]+)') { $ime = $Matches[1] }
  [pscustomobject]@{ Pid = $_.ProcessId; Profil = $ime; Ura = $_.CreationDate }
}
"razlicnih profilov: $(($poimenovani.Profil | Sort-Object -Unique).Count)"
$poimenovani | Group-Object Profil | Sort-Object Name | ForEach-Object {
  $prvi = ($_.Group | Measure-Object -Property Ura -Minimum).Minimum
  "{0}  procesov={1}  starost_min={2}" -f $_.Name, $_.Count, [math]::Round(((Get-Date) - $prvi).TotalMinutes, 1)
}
