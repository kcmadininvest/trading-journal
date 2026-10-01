export type MarkdownTableData = {
  headers: string[];
  rows: string[][];
};

export type MarkdownTableRange = {
  start: number;
  end: number;
  data: MarkdownTableData;
};

const MAX_COLS = 12;
const MAX_ROWS = 20;

function splitCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map((cell) => cell.trim());
}

function isSeparatorLine(line: string): boolean {
  const cells = splitCells(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isTableRowLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  if (isSeparatorLine(trimmed)) return false;
  return trimmed.startsWith('|') || trimmed.endsWith('|') || /\|.+\|/.test(trimmed);
}

export function createEmptyTableData(
  cols: number,
  rows: number,
  headerLabel: (index: number) => string,
): MarkdownTableData {
  const safeCols = Math.max(1, Math.min(cols, MAX_COLS));
  const safeRows = Math.max(1, Math.min(rows, MAX_ROWS));
  return {
    headers: Array.from({ length: safeCols }, (_, i) => headerLabel(i + 1)),
    rows: Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => '')),
  };
}

export function serializeMarkdownTable(data: MarkdownTableData): string {
  const cols = Math.max(1, data.headers.length);
  const headers = data.headers.map((h) => h.trim() || ' ');
  while (headers.length < cols) headers.push(' ');
  const normalizedRows = data.rows.map((row) => {
    const next = row.slice(0, cols).map((cell) => cell.trim() || ' ');
    while (next.length < cols) next.push(' ');
    return next;
  });
  const header = `| ${headers.join(' | ')} |`;
  const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  const body = normalizedRows.map((row) => `| ${row.join(' | ')} |`);
  return [header, separator, ...body].join('\n');
}

/** @deprecated prefer serializeMarkdownTable(createEmptyTableData(...)) */
export function buildMarkdownTable(
  cols: number,
  rows: number,
  headerLabel: (index: number) => string,
): string {
  return serializeMarkdownTable(createEmptyTableData(cols, rows, headerLabel));
}

export function parseMarkdownTable(block: string): MarkdownTableData | null {
  const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  if (!isTableRowLine(lines[0]) || !isSeparatorLine(lines[1])) return null;

  const headers = splitCells(lines[0]);
  if (headers.length === 0) return null;
  const cols = headers.length;
  const rows = lines.slice(2).filter(isTableRowLine).map((line) => {
    const cells = splitCells(line);
    while (cells.length < cols) cells.push('');
    return cells.slice(0, cols);
  });
  return { headers, rows: rows.length > 0 ? rows : [Array.from({ length: cols }, () => '')] };
}

function lineRanges(content: string): Array<{ start: number; end: number; text: string }> {
  const ranges: Array<{ start: number; end: number; text: string }> = [];
  let start = 0;
  const parts = content.split('\n');
  for (let i = 0; i < parts.length; i += 1) {
    const text = parts[i];
    const end = start + text.length;
    ranges.push({ start, end, text });
    start = end + 1;
  }
  return ranges;
}

function isTableLine(line: string): boolean {
  return isTableRowLine(line) || isSeparatorLine(line);
}

export function findMarkdownTableAt(content: string, cursor: number): MarkdownTableRange | null {
  const lines = lineRanges(content);
  if (lines.length === 0) return null;

  let lineIndex = lines.findIndex((line) => cursor >= line.start && cursor <= line.end);
  if (lineIndex < 0) {
    lineIndex = lines.findIndex((line) => cursor >= line.start && cursor <= line.end + 1);
  }
  if (lineIndex < 0 || !isTableLine(lines[lineIndex].text)) return null;

  let startLine = lineIndex;
  while (startLine > 0 && isTableLine(lines[startLine - 1].text)) {
    startLine -= 1;
  }
  let endLine = lineIndex;
  while (endLine < lines.length - 1 && isTableLine(lines[endLine + 1].text)) {
    endLine += 1;
  }

  // Locate header + separator inside the contiguous table block
  let headerLine = -1;
  for (let i = startLine; i < endLine; i += 1) {
    if (isTableRowLine(lines[i].text) && isSeparatorLine(lines[i + 1].text)) {
      headerLine = i;
      break;
    }
  }
  if (headerLine < 0) return null;

  startLine = headerLine;
  endLine = headerLine + 1;
  while (endLine < lines.length - 1 && isTableRowLine(lines[endLine + 1].text)) {
    endLine += 1;
  }

  const blockStart = lines[startLine].start;
  const blockEnd = lines[endLine].end;
  if (cursor < blockStart || cursor > blockEnd + 1) return null;

  const block = content.slice(blockStart, blockEnd);
  const data = parseMarkdownTable(block);
  if (!data) return null;
  return { start: blockStart, end: blockEnd, data };
}

export function findAllMarkdownTables(content: string): MarkdownTableRange[] {
  const results: MarkdownTableRange[] = [];
  const lines = lineRanges(content);
  let i = 0;
  while (i < lines.length - 1) {
    if (isTableRowLine(lines[i].text) && isSeparatorLine(lines[i + 1].text)) {
      let endLine = i + 1;
      while (endLine < lines.length - 1 && isTableRowLine(lines[endLine + 1].text)) {
        endLine += 1;
      }
      const block = content.slice(lines[i].start, lines[endLine].end);
      const data = parseMarkdownTable(block);
      if (data) {
        results.push({ start: lines[i].start, end: lines[endLine].end, data });
      }
      i = endLine + 1;
      continue;
    }
    i += 1;
  }
  return results;
}

export function addTableColumn(data: MarkdownTableData, headerLabel: string): MarkdownTableData {
  if (data.headers.length >= MAX_COLS) return data;
  return {
    headers: [...data.headers, headerLabel],
    rows: data.rows.map((row) => [...row, '']),
  };
}

export function addTableRow(data: MarkdownTableData): MarkdownTableData {
  if (data.rows.length >= MAX_ROWS) return data;
  return {
    headers: data.headers,
    rows: [...data.rows, Array.from({ length: data.headers.length }, () => '')],
  };
}

export function removeTableColumn(data: MarkdownTableData, colIndex: number): MarkdownTableData {
  if (data.headers.length <= 1) return data;
  if (colIndex < 0 || colIndex >= data.headers.length) return data;
  return {
    headers: data.headers.filter((_, i) => i !== colIndex),
    rows: data.rows.map((row) => row.filter((_, i) => i !== colIndex)),
  };
}

export function removeTableRow(data: MarkdownTableData, rowIndex: number): MarkdownTableData {
  if (data.rows.length <= 1) return data;
  if (rowIndex < 0 || rowIndex >= data.rows.length) return data;
  return {
    headers: data.headers,
    rows: data.rows.filter((_, i) => i !== rowIndex),
  };
}

export function updateTableCell(
  data: MarkdownTableData,
  rowIndex: number,
  colIndex: number,
  value: string,
): MarkdownTableData {
  if (rowIndex === -1) {
    const headers = data.headers.map((h, i) => (i === colIndex ? value : h));
    return { ...data, headers };
  }
  const rows = data.rows.map((row, r) =>
    r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
  );
  return { ...data, rows };
}
