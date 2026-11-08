# =============================================================================
# ENVIA ERP · revertir_diseno.ps1
# Restaura el diseño anterior desde _backup_diseno_original.
# Uso:  powershell -ExecutionPolicy Bypass -File .\revertir_diseno.ps1
# =============================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backup = Join-Path $root '_backup_diseno_original'

if (-not (Test-Path $backup)) {
  Write-Host 'No existe la carpeta _backup_diseno_original. No se puede revertir.' -ForegroundColor Red
  exit 1
}

Write-Host 'Restaurando index.html, /css y /js desde el respaldo...' -ForegroundColor Cyan
Copy-Item (Join-Path $backup 'index.html') (Join-Path $root 'index.html') -Force
Copy-Item (Join-Path $backup 'css\*') (Join-Path $root 'css') -Recurse -Force
Copy-Item (Join-Path $backup 'js\*') (Join-Path $root 'js') -Recurse -Force

Write-Host 'Diseño anterior restaurado correctamente.' -ForegroundColor Green
Write-Host 'Abre index.html en Chrome para verificar.' -ForegroundColor Green
