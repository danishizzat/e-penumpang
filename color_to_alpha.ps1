Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\User\.gemini\antigravity\brain\c53a3c46-9aed-4492-998e-e727cf443c06\.user_uploaded\media_1789007349078.png"
$bmp = [System.Drawing.Bitmap]::new($srcPath)
$width = $bmp.Width
$height = $bmp.Height

$outBmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Background key color
$kr = 245.0 / 255.0
$kg = 245.0 / 255.0
$kb = 242.0 / 255.0

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        $cr = [double]$c.R / 255.0
        $cg = [double]$c.G / 255.0
        $cb = [double]$c.B / 255.0

        # Calculate alpha for each channel
        $ar = if ($cr -gt $kr) { ($cr - $kr) / (1.0 - $kr) } elseif ($cr -lt $kr) { ($kr - $cr) / $kr } else { 0.0 }
        $ag = if ($cg -gt $kg) { ($cg - $kg) / (1.0 - $kg) } elseif ($cg -lt $kg) { ($kg - $cg) / $kg } else { 0.0 }
        $ab = if ($cb -gt $kb) { ($cb - $kb) / (1.0 - $kb) } elseif ($cb -lt $kb) { ($kb - $cb) / $kb } else { 0.0 }

        $a = [Math]::Max($ar, [Math]::Max($ag, $ab))

        # Threshold to eliminate faint noise in flat background
        if ($a -lt 0.04) {
            $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            # Decontaminate color
            $cleanR = [Math]::Min(1.0, [Math]::Max(0.0, ($cr - $kr * (1.0 - $a)) / $a))
            $cleanG = [Math]::Min(1.0, [Math]::Max(0.0, ($cg - $kg * (1.0 - $a)) / $a))
            $cleanB = [Math]::Min(1.0, [Math]::Max(0.0, ($cb - $kb * (1.0 - $a)) / $a))

            $alphaInt = [int][Math]::Min(255, [Math]::Max(0, $a * 255))
            $rInt = [int][Math]::Min(255, [Math]::Max(0, $cleanR * 255))
            $gInt = [int][Math]::Min(255, [Math]::Max(0, $cleanG * 255))
            $bInt = [int][Math]::Min(255, [Math]::Max(0, $cleanB * 255))

            $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alphaInt, $rInt, $gInt, $bInt))
        }
    }
}

$destPath = Join-Path $PSScriptRoot "public\assets\marinecareerhub-logo.png"
$outBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$destPath2 = Join-Path $PSScriptRoot "public\assets\logo.png"
$outBmp.Save($destPath2, [System.Drawing.Imaging.ImageFormat]::Png)

$destPath3 = Join-Path $PSScriptRoot "public\assets\marinecareerhub-logo-transparent.png"
$outBmp.Save($destPath3, [System.Drawing.Imaging.ImageFormat]::Png)

$brainPath = "C:\Users\User\.gemini\antigravity\brain\c53a3c46-9aed-4492-998e-e727cf443c06\perfect_transparent.png"
$outBmp.Save($brainPath, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$outBmp.Dispose()
Write-Output "Perfect Color-to-Alpha generated!"
