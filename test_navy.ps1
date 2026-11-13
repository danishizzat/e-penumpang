Add-Type -AssemblyName System.Drawing

$logo = [System.Drawing.Bitmap]::new("public/assets/marinecareerhub-logo-transparent.png")
$testBmp = [System.Drawing.Bitmap]::new($logo.Width + 40, $logo.Height + 40, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($testBmp)

# Fill with header dark navy background #0d3b66
$navyBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 13, 59, 102))
$g.FillRectangle($navyBrush, 0, 0, $testBmp.Width, $testBmp.Height)

# Draw logo directly on navy
$g.DrawImage($logo, 20, 20, $logo.Width, $logo.Height)

$destPath = "C:/Users/User/.gemini/antigravity/brain/c53a3c46-9aed-4492-998e-e727cf443c06/test_on_navy.png"
$testBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$navyBrush.Dispose()
$logo.Dispose()
$testBmp.Dispose()

Write-Output "Rendered test on navy successfully!"
