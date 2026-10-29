param([ValidateSet('start','stop','status')][string]$Action = 'start', [int]$Port = 55432)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $ProjectRoot '.data/postgres'
$Candidates = @($env:PG_BIN, (Join-Path $ProjectRoot '.cache/postgresql/pgsql/bin'), 'D:/PostgreSQL/16/bin', 'D:/PostgreSQL/bin', 'C:/Program Files/PostgreSQL/16/bin')
$PgBin = $Candidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'pg_ctl.exe')) } | Select-Object -First 1
if (-not $PgBin) { throw 'PostgreSQL 16 introuvable. Installer PostgreSQL et définir PG_BIN vers son dossier bin.' }
$PgCtl = Join-Path $PgBin 'pg_ctl.exe'
if ($Action -eq 'stop') { & $PgCtl -D $DataDir -m fast -w stop; exit $LASTEXITCODE }
if ($Action -eq 'status') { & $PgCtl -D $DataDir status; exit $LASTEXITCODE }
if (-not (Test-Path -LiteralPath (Join-Path $DataDir 'PG_VERSION'))) {
  throw 'Cluster absent. Exécuter scripts/init-postgres.mjs après npm run setup pour créer une base locale neuve.'
}
& $PgCtl -D $DataDir status *> $null
if ($LASTEXITCODE -eq 0) { Write-Output 'PostgreSQL local est déjà démarré.'; exit 0 }
& $PgCtl -D $DataDir -l (Join-Path $ProjectRoot '.data/postgres.log') -o "-p $Port -h 127.0.0.1" -w start
exit $LASTEXITCODE
