# apply-fixes.ps1
# Run from project root: .\apply-fixes.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Applying fixes..." -ForegroundColor Cyan

Write-Host ""
Write-Host "[1/5] Root layout"
Copy-Item -Force "fixes\layout.tsx" "app\layout.tsx"
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "[2/5] ModelIcon (image-based)"
Copy-Item -Force "fixes\model-icon.tsx" "components\shared\model-icon.tsx"
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] forgot-password page"
New-Item -ItemType Directory -Force -Path "app\(auth)\forgot-password" | Out-Null
Copy-Item -Force "fixes\forgot-password-page.tsx" "app\(auth)\forgot-password\page.tsx"
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] reset-password page"
New-Item -ItemType Directory -Force -Path "app\(auth)\reset-password" | Out-Null
Copy-Item -Force "fixes\reset-password-page.tsx" "app\(auth)\reset-password\page.tsx"
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Checking for brand image"
New-Item -ItemType Directory -Force -Path "public\icons" | Out-Null
$imgPath = "public\icons\brand-logo.png"
if (Test-Path $imgPath) {
    Write-Host "  brand-logo.png found." -ForegroundColor Green
} else {
    Write-Host "  Drop your image at public\icons\brand-logo.png" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Next steps:" -ForegroundColor Cyan
Write-Host "  1. Copy your brand image to public\icons\brand-logo.png"
Write-Host "  2. git add ."
Write-Host "  3. git commit -m 'fix: toasts, forgot-password routes, image icon'"
Write-Host "  4. git push origin main"