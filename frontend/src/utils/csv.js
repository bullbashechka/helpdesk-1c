function escapeCsvCell(value) {
  const stringValue = value === undefined || value === null ? '' : String(value);
  const escapedValue = stringValue.replace(/"/g, '""');

  if (/[",\r\n]/.test(escapedValue)) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
}

export function buildCsv(columns, rows) {
  const headerLine = columns.map((column) => escapeCsvCell(column.label)).join(',');
  const dataLines = rows.map((row) =>
    columns
      .map((column) => {
        const value = column.getValue ? column.getValue(row) : row[column.key];
        return escapeCsvCell(value);
      })
      .join(','),
  );

  return [headerLine, ...dataLines].join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
