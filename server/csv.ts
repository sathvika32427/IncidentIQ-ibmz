export interface CsvRecord {
  fields: string[];
  lineNumber: number;
  error?: string;
}

export class InvalidCsvError extends Error {}

export function parseCsvRecords(input: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let malformed = false;
  let lineNumber = 1;
  let recordLineNumber = 1;

  const finishRecord = () => {
    if (!malformed && (fields.length > 1 || field.trim())) {
      fields.push(field);
      records.push({ fields, lineNumber: recordLineNumber });
    } else if (malformed) {
      records.push({
        fields: [],
        lineNumber: recordLineNumber,
        error: 'Malformed CSV quoting'
      });
    }
    fields = [];
    field = '';
    malformed = false;
    recordLineNumber = lineNumber + 1;
  };

  for (let index = 0; index < input.length; index++) {
    const character = input[index];

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
        if (character === '\n') lineNumber++;
      }
      continue;
    }

    if (character === ',' && !malformed) {
      fields.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index++;
      finishRecord();
      lineNumber++;
    } else if (character === '"' && field.length === 0 && !malformed) {
      quoted = true;
    } else {
      if (character === '"') malformed = true;
      if (!malformed) field += character;
    }
  }

  if (quoted) malformed = true;
  if (fields.length > 0 || field.trim() || malformed) finishRecord();

  if (records[0]?.fields[0]?.charCodeAt(0) === 0xfeff) {
    records[0].fields[0] = records[0].fields[0].slice(1);
  }

  return records;
}
