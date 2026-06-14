param(
  [string]$EnvironmentFile = "C:\LegalBahi\.env.production"
)

if (-not (Test-Path $EnvironmentFile)) {
  throw "Production environment file was not found at $EnvironmentFile"
}

Get-Content $EnvironmentFile | ForEach-Object {
  $Line = $_.Trim()
  if (-not $Line -or $Line.StartsWith("#")) {
    return
  }
  $Separator = $Line.IndexOf("=")
  if ($Separator -lt 1) {
    throw "Invalid environment line: $Line"
  }
  $Name = $Line.Substring(0, $Separator).Trim()
  $Value = $Line.Substring($Separator + 1)
  [System.Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}
