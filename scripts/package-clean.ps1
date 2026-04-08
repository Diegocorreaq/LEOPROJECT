$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root "artifacts"
$outputZip = Join-Path $outputDir "grupo-leo-clean.zip"
$stagingDir = Join-Path $outputDir "package-staging"

if (Test-Path $outputDir) {
  Remove-Item -LiteralPath $outputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingDir | Out-Null

$itemsToCopy = @(
  "backend",
  "frontend",
  "README.md",
  "SECURITY.md",
  ".gitignore",
  ".gitattributes"
)

foreach ($item in $itemsToCopy) {
  $source = Join-Path $root $item
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination $stagingDir -Recurse -Force
  }
}

$excludedPatterns = @(
  "*.env",
  "*.env.local",
  "*.env.production",
  "*.zip",
  "*.local.json"
)

Get-ChildItem -LiteralPath $stagingDir -Recurse -Force | ForEach-Object {
  if ($_.PSIsContainer -and ($_.Name -in @(".git", ".claude", "node_modules", "dist", "artifacts", "release"))) {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
    return
  }

  foreach ($pattern in $excludedPatterns) {
    if ($_.Name -like $pattern) {
      Remove-Item -LiteralPath $_.FullName -Force
      break
    }
  }
}

Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $outputZip -Force
Write-Host "Paquete limpio generado en: $outputZip"
