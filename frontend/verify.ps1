# Vercel Pre-Flight Check Script
# Run this before pushing to GitHub to catch errors locally.

Write-Host "🚀 Starting Vercel Pre-Flight Check..." -ForegroundColor Cyan

# 1. Linting (Static Analysis)
Write-Host "`n1. Checking Code Quality (Linting)..." -ForegroundColor Yellow
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Linting Failed! Please fix the errors above." -ForegroundColor Red
    Write-Host "   (Tip: Look for 'unused variable' or syntax errors)" -ForegroundColor Gray
    exit 1
} else {
    Write-Host "✅ Linting Passed" -ForegroundColor Green
}

# 2. Building (TypeScript & Vite)
Write-Host "`n2. Simulating Vercel Build (TypeScript & Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build Failed! Vercel will reject this code." -ForegroundColor Red
    Write-Host "   (Tip: Fix TypeScript errors shown above)" -ForegroundColor Gray
    exit 1
} else {
    Write-Host "✅ Build Passed" -ForegroundColor Green
}

Write-Host "`n🎉 All Checks Passed! You are safe to deploy." -ForegroundColor Green
Write-Host "   Run: git push origin main" -ForegroundColor Gray
exit 0
