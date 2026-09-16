export type CsvTable = { headers: string[]; rows: string[][]; delimiter: string };

function detectDelimiter(firstLine: string) {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === delimiter) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
}

function parseRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (quoted && next === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && ch === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseCsv(text: string): CsvTable {
  const normalized = text.replace(/^\uFEFF/, "");
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const parsed = parseRows(normalized, delimiter);
  if (parsed.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha de dados.");

  const headers = parsed[0].map((header, index) => header || `coluna_${index + 1}`);
  const seen = new Set<string>();
  const uniqueHeaders = headers.map((header, index) => {
    let candidate = header;
    let suffix = 2;
    while (seen.has(candidate)) candidate = `${header}_${suffix++}`;
    seen.add(candidate);
    return candidate || `coluna_${index + 1}`;
  });

  const rows = parsed.slice(1).map((row) => uniqueHeaders.map((_, index) => row[index] ?? ""));
  return { headers: uniqueHeaders, rows, delimiter };
}
