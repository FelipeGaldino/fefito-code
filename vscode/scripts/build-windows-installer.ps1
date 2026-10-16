# Build the unsigned Windows x64 installer on a Windows machine.
param(
	[switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$installer = Join-Path $repo '.build\win32-x64\user-setup\FefitoSetup.exe'

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
	throw 'Este instalador precisa ser compilado no Windows.'
}

function Invoke-Step([string]$Name, [string[]]$Arguments) {
	Write-Host "`n==> $Name" -ForegroundColor Cyan
	& npm @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "$Name falhou (código $LASTEXITCODE)."
	}
}

Push-Location $repo
try {
	$env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
	$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
	$env:FOUNDRY_LOCAL_SKIP_INSTALL = '1'
	$env:npm_config_foreground_scripts = 'true'

	if (-not $SkipInstall) {
		Invoke-Step 'Instalar dependências' @('ci')
	}
	Invoke-Step 'Compilar o Fefito' @('run', 'gulp', 'core-ci')
	Invoke-Step 'Montar o aplicativo Windows x64' @('run', 'gulp', 'vscode-win32-x64-min')
	Invoke-Step 'Preparar o atualizador do instalador' @('run', 'gulp', 'vscode-win32-x64-inno-updater')
	Invoke-Step 'Criar o instalador' @('run', 'gulp', 'vscode-win32-x64-user-setup')

	if (-not (Test-Path $installer)) {
		throw "O build terminou sem gerar o instalador esperado: $installer"
	}
	Write-Host "`nInstalador pronto: $installer" -ForegroundColor Green
	Get-FileHash $installer -Algorithm SHA256 | Format-List
} finally {
	Pop-Location
}
