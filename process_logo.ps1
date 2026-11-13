Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "public\assets\logo.png"
$bmp = [System.Drawing.Bitmap]::new($srcPath)
$width = $bmp.Width
$height = $bmp.Height

Write-Output "Image size: $width x $height"

# Target background color is roughly (245, 245, 242)
$bgR = 245.0
$bgG = 245.0
$bgB = 242.0

# 1. Create Transparent Logo (for white / light backgrounds)
$transparentBmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# 2. Create Inverted/White-text Logo (for dark navy header background)
$darkBgBmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        $r = [double]$c.R
        $g = [double]$c.G
        $b = [double]$c.B

        # Euclidean distance from background
        $dist = [Math]::Sqrt(($r - $bgR)*($r - $bgR) + ($g - $bgG)*($g - $bgG) + ($b - $bgB)*($b - $bgB))

        if ($dist -lt 12) {
            # Completely background
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            $darkBgBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($dist -lt 55) {
            # Edge / anti-aliased pixel
            $alphaRatio = ($dist - 12.0) / (55.0 - 12.0)
            $alpha = [int][Math]::Min(255, [Math]::Max(0, $alphaRatio * 255))
            
            # Decontaminate color
            $cleanR = [int][Math]::Min(255, [Math]::Max(0, ($r - $bgR * (1.0 - $alphaRatio)) / $alphaRatio))
            $cleanG = [int][Math]::Min(255, [Math]::Max(0, ($g - $bgG * (1.0 - $alphaRatio)) / $alphaRatio))
            $cleanB = [int][Math]::Min(255, [Math]::Max(0, ($b - $bgB * (1.0 - $alphaRatio)) / $alphaRatio))
            
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $cleanR, $cleanG, $cleanB))

            # For dark background: if it's dark text, shift to white
            if ($cleanB -gt $cleanR + 30 -and $cleanG -gt $cleanR + 30) {
                # Cyan element: keep cyan
                $darkBgBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $cleanR, $cleanG, $cleanB))
            } else {
                # Dark navy element: turn to white
                $darkBgBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
            }
        } else {
            # Fully opaque logo pixel
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))

            # If it's a dark navy/black element (R, G, B all low), turn to white for dark header!
            # Cyan elements have G > 100 and B > 140 and B > R + 40
            if ($c.B -gt ($c.R + 40) -and $c.G -gt ($c.R + 20)) {
                # Cyan element: keep vibrant cyan
                $darkBgBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
            } elseif ($c.R -lt 90 -and $c.G -lt 90 -and $c.B -lt 130) {
                # Dark navy text & swoosh: turn to crisp white
                $darkBgBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
            } else {
                $darkBgBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
            }
        }
    }
}

$destTransparent = Join-Path $PSScriptRoot "public\assets\marinecareerhub-logo-transparent.png"
$destHeader = Join-Path $PSScriptRoot "public\assets\marinecareerhub-logo-header.png"

$transparentBmp.Save($destTransparent, [System.Drawing.Imaging.ImageFormat]::Png)
$darkBgBmp.Save($destHeader, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$transparentBmp.Dispose()
$darkBgBmp.Dispose()

Write-Output "Generated transparent logos successfully!"
