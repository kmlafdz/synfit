Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $projectRoot "public\logo.png"

if (-not (Test-Path $logoPath)) {
    Write-Error "Logo not found at $logoPath"
    exit 1
}

$logo = [System.Drawing.Bitmap]::FromFile($logoPath)
Write-Host "Loaded original logo: $($logo.Width)x$($logo.Height)"

function Generate-PwaIcon {
    param (
        [int]$Size,
        [double]$PaddingRatio, # e.g. 0.15 means logo occupies 70% of size (for maskable), 0.10 means 80% (standard)
        [string]$OutputPath
    )

    $targetBmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($targetBmp)
    
    # Ultra-high quality rendering
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fill pure white background
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($whiteBrush, 0, 0, $Size, $Size)

    # Calculate aspect-ratio fit
    $availWidth = $Size * (1.0 - (2 * $PaddingRatio))
    $availHeight = $Size * (1.0 - (2 * $PaddingRatio))

    $scaleW = $availWidth / $logo.Width
    $scaleH = $availHeight / $logo.Height
    $scale = [Math]::Min($scaleW, $scaleH)

    $drawWidth = [int]($logo.Width * $scale)
    $drawHeight = [int]($logo.Height * $scale)

    $offsetX = [int](($Size - $drawWidth) / 2)
    $offsetY = [int](($Size - $drawHeight) / 2)

    $destRect = New-Object System.Drawing.Rectangle($offsetX, $offsetY, $drawWidth, $drawHeight)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $logo.Width, $logo.Height)

    $g.DrawImage($logo, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $g.Dispose()
    $whiteBrush.Dispose()

    # Save PNG
    $targetBmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $targetBmp.Dispose()
    Write-Host "Generated $OutputPath ($Size x $Size, padding: $([int]($PaddingRatio * 100))%)"
}

# 1. Standard icons (10% padding so logo is large and clear on white bg)
Generate-PwaIcon -Size 192 -PaddingRatio 0.08 -OutputPath (Join-Path $projectRoot "public\icon-192.png")
Generate-PwaIcon -Size 512 -PaddingRatio 0.08 -OutputPath (Join-Path $projectRoot "public\icon-512.png")

# 2. Maskable icons (20% padding so that when Android crops to circle/squircle, the logo remains completely within safe zone)
Generate-PwaIcon -Size 192 -PaddingRatio 0.18 -OutputPath (Join-Path $projectRoot "public\icon-maskable-192.png")
Generate-PwaIcon -Size 512 -PaddingRatio 0.18 -OutputPath (Join-Path $projectRoot "public\icon-maskable-512.png")

# 3. Apple touch icon
Generate-PwaIcon -Size 180 -PaddingRatio 0.08 -OutputPath (Join-Path $projectRoot "public\apple-touch-icon.png")

# 4. Next.js app icon
Generate-PwaIcon -Size 512 -PaddingRatio 0.08 -OutputPath (Join-Path $projectRoot "src\app\icon.png")

$logo.Dispose()
Write-Host "All PWA white background icons generated successfully!"
