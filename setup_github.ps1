# GitHub Setup Script for Statsify
# This script helps initialize the git repository and push your code to GitHub.

Write-Host "🎨 Statsify GitHub Setup Utility" -ForegroundColor Cyan
Write-Host "--------------------------------"

# Check if git is installed
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Git is not installed or not in your PATH." -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/downloads and try again."
    exit
}

# Initialize Git Repository
if (-not (Test-Path ".git")) {
    Write-Host "📂 Initializing generic Git repository..." -ForegroundColor Yellow
    git init
} else {
    Write-Host "✅ Git repository already initialized." -ForegroundColor Green
}

# Add all files
Write-Host "➕ Adding files to staging..." -ForegroundColor Yellow
git add .

# Create initial commit
Write-Host "💾 Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Statsify Pro v1.0"

# Prompt for Remote URL
Write-Host "`n🔗 Connect to GitHub" -ForegroundColor Cyan
Write-Host "1. Create a NEW repository on GitHub (https://github.com/new)"
Write-Host "2. Copy the HTTPS URL (ending in .git)"
$remoteUrl = Read-Host "Enter your GitHub Repository URL"

if ($remoteUrl) {
    # Check if remote exists
    $existingRemote = git remote get-url origin 2>$null
    if ($existingRemote) {
        Write-Host "⚠️  Remote 'origin' already exists ($existingRemote). Updating..." -ForegroundColor Yellow
        git remote set-url origin $remoteUrl
    } else {
        git remote add origin $remoteUrl
    }

    # Rename branch to main
    git branch -M main

    # Push
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan
    git push -u origin main
    
    if ($?) {
        Write-Host "`n✅ Successfully uploaded to GitHub!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Push failed. You might need to sign in or check your URL." -ForegroundColor Red
    }
} else {
    Write-Host "No URL provided. Skipping push." -ForegroundColor Yellow
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
