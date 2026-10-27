export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "message\r\nNo records in selected period\r\n";
  const keys = Object.keys(rows[0]!);
  const cell = (value: unknown) => {
    let text =
      value instanceof Date ? value.toISOString() : String(value ?? "");
    if (/^[\t\r\n ]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    keys.map(cell).join(","),
    ...rows.map((row) => keys.map((k) => cell(row[k])).join(",")),
  ].join("\r\n");
}
