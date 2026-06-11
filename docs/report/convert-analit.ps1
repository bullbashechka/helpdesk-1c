# Конвертация аналитической части в отдельный .docx + краткая проверка.
$htmlPath = 'c:\Users\fm\Documents\Business\helpdesk-1c\docs\report\analiticheskaya-chast.html'
$docxPath = 'c:\Users\fm\Documents\Business\helpdesk-1c\docs\report\Аналитическая_часть.docx'

$wdFormatXMLDocument = 12
$pointsPerCm = 28.3464567

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($htmlPath, $false, $false)

    $doc.PageSetup.LeftMargin = 3 * $pointsPerCm
    $doc.PageSetup.RightMargin = 1.5 * $pointsPerCm
    $doc.PageSetup.TopMargin = 2 * $pointsPerCm
    $doc.PageSetup.BottomMargin = 2 * $pointsPerCm
    $doc.AutoHyphenation = $false

    if (Test-Path $docxPath) { Remove-Item $docxPath -Force }
    $doc.SaveAs2($docxPath, $wdFormatXMLDocument)

    $doc.Repaginate()
    Write-Output ("Сохранено: {0}" -f $docxPath)
    Write-Output ("Страниц: {0}" -f $doc.ComputeStatistics(2))
    Write-Output ("Таблиц: {0}" -f $doc.Tables.Count)

    $h1 = 0; $h2 = 0; $h3 = 0
    foreach ($p in $doc.Paragraphs) {
        switch ($p.OutlineLevel) {
            1 { $h1++ }
            2 { $h2++ }
            3 { $h3++ }
        }
    }
    Write-Output ("Заголовков H1/H2/H3: {0}/{1}/{2}" -f $h1, $h2, $h3)

    $doc.Close($false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
