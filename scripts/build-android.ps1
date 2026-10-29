param([switch]$Production, [ValidateSet('assembleRelease','bundleRelease')][string]$Task = 'assembleRelease')
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $ProjectRoot 'apps/mobile/android'
$Jdk = Get-ChildItem (Join-Path $ProjectRoot '.cache/jdk17') -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/java.exe') } | Select-Object -First 1
if ($Jdk) { $env:JAVA_HOME = $Jdk.FullName }
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'JDK 17 requis. Définir JAVA_HOME.' }
$Sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android/Sdk'), (Join-Path $ProjectRoot '.cache/android/sdk')) | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platform-tools/adb.exe')) } | Select-Object -First 1
if (-not $Sdk) { throw 'SDK Android absent. Installer Android SDK 36 et définir ANDROID_HOME.' }
$env:ANDROID_HOME = $Sdk
$env:GRADLE_USER_HOME = Join-Path $ProjectRoot '.cache/gradle'
if ($Production) {
  if (-not $env:SOS_KEYSTORE_FILE -or -not $env:SOS_KEYSTORE_PASSWORD -or -not $env:SOS_KEY_ALIAS -or -not $env:SOS_KEY_PASSWORD) { throw 'Les quatre variables de signature SOS_KEYSTORE_* et SOS_KEY_* sont requises.' }
  $env:SOS_PRODUCTION_BUILD = 'true'
  $env:EXPO_PUBLIC_DEMO_MODE = 'false'
} else {
  $env:SOS_PRODUCTION_BUILD = 'false'
  $env:EXPO_PUBLIC_DEMO_MODE = 'true'
}
Set-Content -LiteralPath (Join-Path $AndroidDir 'local.properties') -Value ('sdk.dir=' + $Sdk.Replace('\','/')) -Encoding Ascii
Push-Location $ProjectRoot
try {
  & npm.cmd run android:prebuild
  if ($LASTEXITCODE -ne 0) { throw 'La génération Android a échoué.' }
  Push-Location $AndroidDir
  try {
    & ./gradlew.bat $Task --no-daemon --max-workers=1
    if ($LASTEXITCODE -ne 0) { throw 'Compilation Android échouée. Aucun nouvel APK livré.' }
  } finally { Pop-Location }
  if ($Task -eq 'assembleRelease') {
    $Source = Join-Path $AndroidDir 'app/build/outputs/apk/release/app-release.apk'
    if (-not (Test-Path -LiteralPath $Source)) { throw 'Gradle terminé sans APK attendu.' }
    $Destination = Join-Path $ProjectRoot ('artifacts/SOS-DOCTEURS-' + $(if ($Production) { 'production' } else { 'demo' }) + '.apk')
    New-Item -ItemType Directory -Path (Join-Path $ProjectRoot 'artifacts') -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination
    Write-Output "APK créé : $Destination"
  }
} finally { Pop-Location }
