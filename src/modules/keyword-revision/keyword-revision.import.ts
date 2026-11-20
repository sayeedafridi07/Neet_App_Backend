import ExcelJS from "exceljs";

export type ParsedKeywordRevision = {
  index: number;
  rowNumber: number;
  title: string;
  description?: string;
  duration?: number;
  order?: number;
  error?: string;
};

// Header names are matched loosely ("Sort Order", "sort_order", "SortOrder").
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

const cellText = (cell: ExcelJS.Cell) => {
  const value = cell.value;

  if (value && typeof value === "object" && "richText" in value) {
    return value.richText.map((run) => run.text).join("").trim();
  }

  return (cell.text ?? "").trim();
};

const findColumn = (columns: Map<string, number>, ...names: string[]) =>
  names.map((name) => columns.get(name)).find((column) => column !== undefined);

const parsePositiveInt = (value: string) => {
  if (!value) {
    return undefined;
  }

  const number = Number(value);

  return Number.isInteger(number) && number >= 1 ? number : null;
};

// One keyword per row: "Highlighted word" becomes the title and
// "NCERT reference" the description. Optional "Duration" (seconds) and
// "Order" columns are honoured; "Audio file name" is ignored until audio is
// wired up.
export const parseKeywordRevisionsFromXlsx = async (
  buffer: Buffer,
): Promise<ParsedKeywordRevision[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return [];
  }

  const columns = new Map<string, number>();

  sheet.getRow(1).eachCell((cell, column) => {
    columns.set(normalizeHeader(cellText(cell)), column);
  });

  const titleColumn = findColumn(columns, "highlightedword", "keyword", "keywords", "title");

  if (!titleColumn) {
    throw new Error('The first row must have a "Highlighted word" column');
  }

  const descriptionColumn = findColumn(columns, "ncertreference", "description");
  const durationColumn = findColumn(columns, "duration", "durationseconds");
  const orderColumn = findColumn(columns, "order", "sortorder");

  const results: ParsedKeywordRevision[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const read = (column?: number) => (column ? cellText(row.getCell(column)) : "");

    const title = read(titleColumn);
    const description = read(descriptionColumn) || undefined;

    // Blank rows are skipped rather than reported.
    if (!title && !description) {
      continue;
    }

    const entry: ParsedKeywordRevision = {
      index: results.length + 1,
      rowNumber,
      title,
      description,
    };

    const duration = parsePositiveInt(read(durationColumn));
    const order = parsePositiveInt(read(orderColumn));

    if (!title) {
      entry.error = `Row ${rowNumber}: keyword is required`;
    } else if (duration === null) {
      entry.error = `Row ${rowNumber}: duration must be a positive whole number of seconds`;
    } else if (order === null) {
      entry.error = `Row ${rowNumber}: order must be a positive whole number`;
    } else {
      entry.duration = duration;
      entry.order = order;
    }

    results.push(entry);
  }

  return results;
};
