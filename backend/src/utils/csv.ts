/** Quote every field and neutralize spreadsheet formula injection. */
export function csvCell(value: unknown) {
  const text=String(value??'');
  return `"${(/^[=+\-@\t\r]/.test(text)?"'":"")+text.replace(/"/g,'""')}"`;
}
export function csvDocument(rows:unknown[][]) {return '\uFEFF'+rows.map((row)=>row.map(csvCell).join(',')).join('\r\n');}
