import mammoth from "mammoth";

import { createQuestionSchema, type CreateQuestionData } from "./quiz.schema.js";

/* -------------------------------------------------------------------------- */
/* TOKENS                                                                     */
/* -------------------------------------------------------------------------- */

// The document is flattened into paragraphs and tables. Tables are kept as
// rows of cells so options laid out in a grid can still be recovered.
type TextToken = {
  kind: "text";
  // Plain text, used to recognise answers, options and labels.
  text: string;
  // The same line with formatting kept, which is what gets stored.
  markdown: string;
  // Word auto-numbered lists drop their "(a)" labels in the HTML output, so
  // the list a line belongs to is tracked to recover option order.
  listId?: number;
};

type TableToken = {
  kind: "table";
  rows: string[][];
};

type Token = TextToken | TableToken;

type Option = { letter: string; text: string };

export type ParsedQuestion = {
  index: number;
  data?: CreateQuestionData;
  error?: string;
  preview: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }

    return ENTITIES[entity.toLowerCase()] ?? match;
  });

const cleanText = (value: string) =>
  decodeEntities(value.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

// Labels cut out of a formatted line ("**(a)** Lamarck") leave a stray "**".
const tidyEmphasis = (value: string) => {
  const text = value.trim();

  if ((text.match(/\*\*/g)?.length ?? 0) % 2 === 0) {
    return text;
  }

  return text.replace(/^\*\*\s*|\s*\*\*$/, "").trim();
};

// Keeps the formatting the frontend renders: bold, italics and LaTeX-style
// superscripts/subscripts (m/s<sup>2</sup> -> m/s$^{2}$).
const toMarkdown = (html: string) => {
  const markdown = decodeEntities(
    html
      .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, (_, inner: string) => {
        const text = cleanText(inner);
        return text ? `$^{${text}}$` : "";
      })
      .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, (_, inner: string) => {
        const text = cleanText(inner);
        return text ? `$_{${text}}$` : "";
      })
      .replace(/<\/?(?:strong|b)(?:\s[^>]*)?>/gi, "**")
      .replace(/<\/?(?:em|i)(?:\s[^>]*)?>/gi, "*")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    // Adjacent runs ("**A****B**") and empty runs ("** **") collapse.
    .replace(/\*\*\s*\*\*/g, (gap) => (gap.length > 4 ? " " : ""))
    .trim();

  return tidyEmphasis(markdown);
};

// Splits a fragment of HTML into its lines, honouring <br> inside a paragraph.
const htmlToLines = (html: string) =>
  html
    .split(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/i)
    .map((line) => ({ text: cleanText(line), markdown: toMarkdown(line) }))
    .filter((line) => line.text);

const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  let listCounter = 0;

  const parts = html.split(/(<table[\s\S]*?<\/table>|<ol[\s\S]*?<\/ol>)/i);

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (/^<table/i.test(part)) {
      const rows = [...part.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map(([, row]) =>
          [...row!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
            ([, cell]) =>
              htmlToLines(cell!)
                .map((line) => line.markdown)
                .join(" "),
          ),
        )
        .filter((row) => row.some(Boolean));

      if (rows.length) {
        tokens.push({ kind: "table", rows });
      }

      continue;
    }

    if (/^<ol/i.test(part)) {
      listCounter += 1;

      for (const [, item] of part.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        for (const line of htmlToLines(item!)) {
          tokens.push({ kind: "text", ...line, listId: listCounter });
        }
      }

      continue;
    }

    for (const line of htmlToLines(part)) {
      tokens.push({ kind: "text", ...line });
    }
  }

  return tokens;
};

/* -------------------------------------------------------------------------- */
/* PATTERNS                                                                   */
/* -------------------------------------------------------------------------- */

const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];

const ANSWER_PATTERN = /^(?:ans(?:wer)?|correct\s+(?:answer|option))\s*[:.\-–]?\s*\(?\s*([a-f])\s*\)?/i;

const OPTION_PATTERN = /^\(\s*([a-f])\s*\)\s*(.*)$|^([a-f])[.)]\s+(.*)$/i;

// Same shapes as OPTION_PATTERN, allowing the label itself to be bold/italic.
const OPTION_LABEL_PATTERN = /^(\*\*)?\s*(?:\(\s*[a-f]\s*\)|[a-f][.)])\s*\1\s*/i;

const EXPLANATION_PATTERN = /^(?:explanation|solution|sol|hint)\s*[:.\-–]\s*(.*)$/i;

const EXPLANATION_LABEL_PATTERN = /^(\*\*)?\s*(?:explanation|solution|sol|hint)\s*[:.\-–]\s*\1\s*/i;

const QUESTION_NUMBER_PATTERN = /^(?:q(?:uestion)?\s*\.?\s*)?\d{1,3}\s*[.):]\s+/i;

const QUESTION_NUMBER_LABEL_PATTERN = /^(\**)\s*(?:q(?:uestion)?\s*\.?\s*)?\d{1,3}\s*[.):]\s+/i;

// "Assertion (A):", "Reason (R):", "Statement I:" are bolded like the
// questions created through the API.
const LABEL_PATTERN =
  /^((?:assertion|reason)\s*(?:\(\s*[ar]\s*\))?|statement\s*(?:[ivx]+|\d+))\s*:\s*/i;

const OPTIONS_HEADING_PATTERN = /^options?\s*:?$/i;

/* -------------------------------------------------------------------------- */
/* OPTIONS                                                                    */
/* -------------------------------------------------------------------------- */

// "(a) Lamarck (b) Ernst Mayr (c) ..." on one line. Only labels that follow
// in sequence split the line, so "(a) (a)" stays a single option.
const splitInlineOptions = (text: string, startLetter: string) => {
  const options: Option[] = [];
  const matcher = /\(\s*([a-f])\s*\)/gi;

  let expected = OPTION_LETTERS.indexOf(startLetter);
  let current: { letter: string; start: number } | null = null;

  for (const match of text.matchAll(matcher)) {
    const letter = match[1]!.toLowerCase();

    if (OPTION_LETTERS.indexOf(letter) !== expected) {
      continue;
    }

    if (current) {
      options.push({
        letter: current.letter,
        text: tidyEmphasis(text.slice(current.start, match.index)),
      });
    }

    current = { letter, start: match.index! + match[0].length };
    expected += 1;
  }

  if (current) {
    options.push({ letter: current.letter, text: tidyEmphasis(text.slice(current.start)) });
  }

  return options;
};

// Matching runs on the plain text; the stored option text is the markdown.
const parseOptionLine = (text: string, markdown = text) => {
  const match = text.match(OPTION_PATTERN);

  if (!match) {
    return null;
  }

  const letter = (match[1] ?? match[3])!.toLowerCase();
  const inline = splitInlineOptions(markdown, letter);

  if (inline.length > 1) {
    return inline;
  }

  return [{ letter, text: tidyEmphasis(markdown.replace(OPTION_LABEL_PATTERN, "")) }];
};

// Options are the trailing run of "(a)".."(d)" lines before the answer. The
// scan walks backwards so labels inside the stem (e.g. table rows) are left
// alone.
const extractOptions = (tokens: Token[]) => {
  const options: Option[] = [];
  let cursor = tokens.length - 1;

  while (cursor >= 0) {
    const token = tokens[cursor]!;

    if (token.kind !== "text") {
      break;
    }

    const parsed = parseOptionLine(token.text, token.markdown);

    if (!parsed) {
      break;
    }

    options.unshift(...parsed);
    cursor -= 1;

    if (parsed[0]!.letter === "a") {
      break;
    }
  }

  if (options.length && options[0]!.letter === "a") {
    return { options, stem: tokens.slice(0, cursor + 1) };
  }

  // Word numbered list: "(a)" is list formatting, not text.
  const last = tokens[tokens.length - 1];

  if (last?.kind === "text" && last.listId !== undefined) {
    let start = tokens.length - 1;

    while (start > 0) {
      const previous = tokens[start - 1]!;

      if (previous.kind !== "text" || previous.listId !== last.listId) {
        break;
      }

      start -= 1;
    }

    const items = tokens.slice(start) as TextToken[];

    if (items.length >= 2 && items.length <= OPTION_LETTERS.length) {
      return {
        options: items.map((item, index) => ({
          letter: OPTION_LETTERS[index]!,
          text: item.markdown,
        })),
        stem: tokens.slice(0, start),
      };
    }
  }

  // Options laid out in a table, e.g. a 2x2 grid of "(a) ..." cells.
  if (last?.kind === "table") {
    const cells = last.rows.flat().filter(Boolean);
    const parsed = cells.map((cell) => parseOptionLine(cell.replace(/\*/g, ""), cell));

    if (parsed.length >= 2 && parsed.every(Boolean)) {
      return {
        options: parsed.flatMap((option) => option!),
        stem: tokens.slice(0, -1),
      };
    }
  }

  return { options: [], stem: tokens };
};

/* -------------------------------------------------------------------------- */
/* QUESTION BUILDING                                                          */
/* -------------------------------------------------------------------------- */

const escapeCell = (cell: string) => cell.replace(/\|/g, "\\|");

// Rows are padded to the widest row; the first row is the header.
const tableToMarkdown = (rows: string[][]) => {
  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => escapeCell(row[i] ?? "")).join(" | ")} |`;

  return [line(rows[0]!), `|${"---|".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
};

const formatLine = (markdown: string) =>
  markdown.replace(LABEL_PATTERN, (_, label: string) => `**${label.trim()}:** `);

const buildQuestion = (
  stem: Token[],
  options: Option[],
  answer: string,
  explanation: string | undefined,
): CreateQuestionData => {
  // A lone "Options" heading sits between the stem and the options.
  const tokens = stem.filter(
    (token) => !(token.kind === "text" && OPTIONS_HEADING_PATTERN.test(token.text)),
  );

  const firstLine = tokens.findIndex((token) => token.kind === "text");

  if (firstLine !== -1) {
    const token = tokens[firstLine] as TextToken;

    if (QUESTION_NUMBER_PATTERN.test(token.text)) {
      tokens[firstLine] = {
        ...token,
        markdown: tidyEmphasis(token.markdown.replace(QUESTION_NUMBER_LABEL_PATTERN, "$1")),
      };
    }
  }

  // Paragraphs and tables are separate markdown blocks.
  const blocks = tokens
    .map((token) =>
      token.kind === "text" ? formatLine(token.markdown) : tableToMarkdown(token.rows),
    )
    .filter(Boolean);

  return {
    question: blocks.join("\n\n"),
    explanation,
    isActive: true,
    options: options.map((option) => ({
      text: option.text,
      isCorrect: option.letter === answer,
    })),
  };
};

const previewOf = (tokens: Token[]) => {
  const first = tokens.find((token): token is TextToken => token.kind === "text");

  return (first?.text ?? "").slice(0, 80);
};

/* -------------------------------------------------------------------------- */
/* ENTRY POINT                                                                */
/* -------------------------------------------------------------------------- */

// Each question ends at its "Ans: (x)" line. Explanation lines that follow an
// answer are attached to that question rather than the next one.
export const parseQuestionsFromHtml = (html: string): ParsedQuestion[] => {
  const tokens = tokenize(html);

  const results: ParsedQuestion[] = [];
  let block: Token[] = [];

  const pending: {
    stem: Token[];
    options: Option[];
    answer: string;
    explanation: string[];
  }[] = [];

  for (const token of tokens) {
    if (token.kind === "text") {
      const answer = token.text.match(ANSWER_PATTERN);

      if (answer) {
        const { options, stem } = extractOptions(block);

        pending.push({
          stem,
          options,
          answer: answer[1]!.toLowerCase(),
          explanation: [],
        });
        block = [];
        continue;
      }

      if (EXPLANATION_PATTERN.test(token.text) && block.length === 0 && pending.length) {
        pending[pending.length - 1]!.explanation.push(
          tidyEmphasis(token.markdown.replace(EXPLANATION_LABEL_PATTERN, "")),
        );
        continue;
      }
    }

    block.push(token);
  }

  pending.forEach((entry, i) => {
    const preview = previewOf(entry.stem);
    const index = i + 1;

    if (!entry.options.length) {
      results.push({ index, preview, error: "No options found before the answer" });
      return;
    }

    if (!entry.options.some((option) => option.letter === entry.answer)) {
      results.push({
        index,
        preview,
        error: `Answer (${entry.answer}) does not match any option`,
      });
      return;
    }

    const built = buildQuestion(
      entry.stem,
      entry.options,
      entry.answer,
      entry.explanation.join("\n\n") || undefined,
    );

    const parsed = createQuestionSchema.safeParse(built);

    if (!parsed.success) {
      results.push({
        index,
        preview,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "question"}: ${issue.message}`)
          .join(", "),
      });
      return;
    }

    results.push({ index, preview, data: parsed.data });
  });

  const trailing = block.filter(
    (token) => token.kind === "table" || token.text.trim(),
  );

  if (trailing.length) {
    results.push({
      index: pending.length + 1,
      preview: previewOf(trailing),
      error: 'Question has no "Ans:" line',
    });
  }

  return results;
};

export const parseQuestionsFromDocx = async (
  buffer: Buffer,
): Promise<ParsedQuestion[]> => {
  const { value: html } = await mammoth.convertToHtml({ buffer });

  return parseQuestionsFromHtml(html);
};
