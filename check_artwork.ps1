Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "public\assets\logo.png"
$bmp = [System.Drawing.Bitmap]::new($srcPath)

$maxArtworkR = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # If it is far from background
        $dist = [Math]::Sqrt([Math]::Pow($c.R - 245, 2) + [Math]::Pow($c.G - 245, 2) + [Math]::Pow($c.B - 242, 2))
        if ($dist -gt 80) {
            if ($c.R -gt $maxArtworkR) { $maxArtworkR = $c.R }
        }
    }
}
Write-Output "Max R in fully opaque artwork: $maxArtworkR"
$bmp.Dispose()
