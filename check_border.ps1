Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "public\assets\logo.png"
$bmp = [System.Drawing.Bitmap]::new($srcPath)
$width = $bmp.Width
$height = $bmp.Height

$minR = 255; $maxR = 0
$minG = 255; $maxG = 0
$minB = 255; $maxB = 0

# Check border pixels (top row, bottom row, left col, right col)
for ($x = 0; $x -lt $width; $x++) {
    $c1 = $bmp.GetPixel($x, 0)
    $c2 = $bmp.GetPixel($x, $height - 1)
    foreach ($c in @($c1, $c2)) {
        if ($c.R -lt $minR) { $minR = $c.R }; if ($c.R -gt $maxR) { $maxR = $c.R }
        if ($c.G -lt $minG) { $minG = $c.G }; if ($c.G -gt $maxG) { $maxG = $c.G }
        if ($c.B -lt $minB) { $minB = $c.B }; if ($c.B -gt $maxB) { $maxB = $c.B }
    }
}

Write-Output "Border RGB ranges: R=[$minR, $maxR], G=[$minG, $maxG], B=[$minB, $maxB]"
$bmp.Dispose()
