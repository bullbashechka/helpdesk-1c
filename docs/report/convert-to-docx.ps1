# Конвертация HTML-отчета в .docx через COM-автоматизацию Microsoft Word.
# Запуск: powershell -File convert-to-docx.ps1

param(
    [string]$HtmlPath = (Join-Path $PSScriptRoot 'otchet-praktika-2.html'),
    [string]$DocxPath = (Join-Path $PSScriptRoot 'Отчет_производственная_практика_2.docx')
)

$wdFormatXMLDocument = 12
$wdStatisticPages = 2
$pointsPerCm = 28.3464567

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($HtmlPath, $false, $false)

    # Поля страницы по требованиям к отчету: левое 3 см, правое 1,5 см, верхнее и нижнее 2 см.
    $doc.PageSetup.LeftMargin = 3 * $pointsPerCm
    $doc.PageSetup.RightMargin = 1.5 * $pointsPerCm
    $doc.PageSetup.TopMargin = 2 * $pointsPerCm
    $doc.PageSetup.BottomMargin = 2 * $pointsPerCm

    # Автоперенос слов отключен, чтобы переносы не ломали таблицы.
    $doc.AutoHyphenation = $false

    if (Test-Path $DocxPath) { Remove-Item $DocxPath -Force }
    $doc.SaveAs2($DocxPath, $wdFormatXMLDocument)

    $doc.Repaginate()
    $pages = $doc.ComputeStatistics($wdStatisticPages)
    Write-Output "Сохранено: $DocxPath"
    Write-Output "Страниц: $pages"

    $doc.Close($false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
