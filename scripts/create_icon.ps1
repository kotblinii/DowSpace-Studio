Add-Type -AssemblyName System.Drawing

$bmp = [System.Drawing.Bitmap]::new(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Fundo arredondado
$rect = [System.Drawing.Rectangle]::new(8, 8, 240, 240)
$c1 = [System.Drawing.Color]::FromArgb(255, 13, 17, 23)
$c2 = [System.Drawing.Color]::FromArgb(255, 26, 35, 50)
$brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)

$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$d = 48
$path.AddArc(8, 8, $d, $d, 180, 90)
$path.AddArc(248 - $d, 8, $d, $d, 270, 90)
$path.AddArc(248 - $d, 248 - $d, $d, $d, 0, 90)
$path.AddArc(8, 248 - $d, $d, $d, 90, 90)
$path.CloseFigure()

$g.FillPath($brush, $path)

# Borda ciano neon
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 0, 210, 255), 5.0)
$g.DrawPath($pen, $path)

# Símbolo Play estilizado ciano & magenta
$playRect = [System.Drawing.Rectangle]::new(85, 75, 100, 110)
$cyan = [System.Drawing.Color]::FromArgb(255, 0, 210, 255)
$magenta = [System.Drawing.Color]::FromArgb(255, 217, 70, 239)
$playBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($playRect, $cyan, $magenta, [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)

$p1 = [System.Drawing.Point]::new(95, 75)
$p2 = [System.Drawing.Point]::new(185, 128)
$p3 = [System.Drawing.Point]::new(95, 181)
$g.FillPolygon($playBrush, @($p1, $p2, $p3))

# Pequena barra de clapper no topo
$topRect = [System.Drawing.Rectangle]::new(75, 46, 106, 14)
$topBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($topRect, $cyan, $magenta, [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)
$g.FillRectangle($topBrush, 75, 46, 106, 14)

New-Item -ItemType Directory -Force -Path "assets" | Out-Null
$bmp.Save("assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Salvar como .ico
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$stream = [System.IO.FileStream]::new("assets\icon.ico", [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$bmp.Dispose()
$g.Dispose()

Write-Output "Icon generated successfully!"
