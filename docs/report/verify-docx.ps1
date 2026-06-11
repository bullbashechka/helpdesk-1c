# Проверка собранного .docx: страницы, стили заголовков, разрывы, таблицы, заглушки, гиперссылки.
param(
    [string]$DocxPath = (Join-Path $PSScriptRoot 'Отчет_производственная_практика_2.docx')
)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($DocxPath, $false, $true)
    $doc.Repaginate()

    $pages = $doc.ComputeStatistics(2)
    Write-Output ("Pages: {0}" -f $pages)

    $h1 = 0; $h2 = 0; $h3 = 0
    $h1Info = @()
    $prevPara = $null
    foreach ($p in $doc.Paragraphs) {
        $lvl = $p.OutlineLevel
        if ($lvl -eq 1) {
            $h1++
            $curPage = $p.Range.Information(3)
            $prevPage = if ($prevPara) { $prevPara.Range.Information(3) } else { 0 }
            $breakOk = if ($h1 -eq 1) { 'first' } elseif ($prevPage -lt $curPage) { 'new-page OK' } else { 'NO BREAK!' }
            $h1Info += ("page {0} ({1})" -f $curPage, $breakOk)
        } elseif ($lvl -eq 2) { $h2++ }
        elseif ($lvl -eq 3) { $h3++ }
        $prevPara = $p
    }
    Write-Output ("H1 count: {0} -> {1}" -f $h1, ($h1Info -join '; '))
    Write-Output ("H2 count: {0}" -f $h2)
    Write-Output ("H3 count: {0}" -f $h3)

    Write-Output ("Tables: {0}" -f $doc.Tables.Count)
    Write-Output ("Hyperlinks: {0}" -f $doc.Hyperlinks.Count)

    $textWidth = $doc.PageSetup.PageWidth - $doc.PageSetup.LeftMargin - $doc.PageSetup.RightMargin
    $wide = 0; $unknown = 0
    foreach ($t in $doc.Tables) {
        try {
            $w = 0
            foreach ($c in $t.Columns) { $w += $c.Width }
            if ($w -gt ($textWidth + 2)) { $wide++ }
        } catch { $unknown++ }
    }
    Write-Output ("Text width pt: {0}; tables wider than text area: {1}; non-uniform (skipped): {2}" -f [math]::Round($textWidth, 1), $wide, $unknown)

    $count = 0
    $range = $doc.Content
    $range.Find.ClearFormatting()
    while ($range.Find.Execute('МЕСТО ДЛЯ')) { $count++ }
    Write-Output ("Placeholders 'МЕСТО ДЛЯ': {0}" -f $count)

    $doc.Close($false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
