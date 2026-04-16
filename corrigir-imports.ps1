# corrigir-imports.ps1
# Script para corrigir todos os imports de ../_shared para ./_shared

$files = Get-ChildItem -Path "base44/functions/*.ts" -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Substituir ../_shared/ por ./_shared/
    $newContent = $content -replace '\.\./_shared/', './_shared/'
    
    if ($content -ne $newContent) {
        Set-Content $file.FullName $newContent -NoNewline
        Write-Host "✅ Corrigido: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Sem alterações: $($file.Name)" -ForegroundColor Gray
    }
}

Write-Host "`n🎉 Concluído! Verificando..." -ForegroundColor Cyan

# Verificar se ainda há imports errados
$erros = Get-Content "base44/functions/*.ts" | Select-String -Pattern "from.*\.\./_shared"
if ($erros) {
    Write-Host "`n❌ Ainda há imports errados:" -ForegroundColor Red
    $erros | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
} else {
    Write-Host "`n✅ Todos os imports estão corretos!" -ForegroundColor Green
}