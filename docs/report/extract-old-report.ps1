# Извлечение текста из старого отчета по практике 1 для сравнения.
$src = 'c:\Users\fm\Documents\Business\helpdesk-1c\НЕ_УДАЛЯТЬ_ПРИГОДИТСЯ_ДЛЯ_ОТЧЕТОВ.docx'
$dst = 'c:\Users\fm\Documents\Business\helpdesk-1c\docs\report\old-report-text.txt'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($src, $false, $true)
    $text = $doc.Content.Text -replace "`r", "`r`n"
    [System.IO.File]::WriteAllText($dst, $text, [System.Text.UTF8Encoding]::new($true))
    Write-Output ("Extracted {0} chars to {1}" -f $text.Length, $dst)
    $doc.Close($false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
