# deploy-overview.ps1
# overview.html + screenshots/ を Surge にデプロイするスクリプト
# 対象: soa-ai-render.surge.sh

$Domain   = "soa-ai-render.surge.sh"
$SrcHtml  = "$PSScriptRoot\public\overview.html"
$SrcShots = "$PSScriptRoot\public\screenshots"
$TmpDir   = "$PSScriptRoot\.surge-tmp"

# 一時フォルダ作成
if (Test-Path $TmpDir) { Remove-Item $TmpDir -Recurse -Force }
New-Item -ItemType Directory -Path $TmpDir | Out-Null

# overview.html → index.html としてコピー
Copy-Item $SrcHtml "$TmpDir\index.html"

# screenshots/ フォルダをコピー（.gitkeep は除外）
if (Test-Path $SrcShots) {
    $Dest = "$TmpDir\screenshots"
    New-Item -ItemType Directory -Path $Dest | Out-Null
    Get-ChildItem $SrcShots -Exclude ".gitkeep" | ForEach-Object {
        Copy-Item $_.FullName $Dest
    }
}

Write-Host ">> デプロイ先: https://$Domain" -ForegroundColor Cyan
surge $TmpDir $Domain

# 後片付け
Remove-Item $TmpDir -Recurse -Force
Write-Host "Done" -ForegroundColor Green
