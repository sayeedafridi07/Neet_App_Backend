import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import ExcelJS from "exceljs";
import mammoth from "mammoth";

import { isSupportedImage } from "../../config/multer.js";
import { replaceEquations } from "./quiz.omml.js";
import { createQuestionSchema, type CreateQuestionData } from "./quiz.schema.js";

export type DocImage = {
  buffer: Buffer;
  contentType: string;
};

export type ParsedQuestion = {
  index: number;
  data?: CreateQuestionData;
  image?: DocImage;
  // Lined up with data.options.
  optionImages?: (DocImage | undefined)[];
  explanationImage?: DocImage;
  error?: string;
  preview: string;
};

/* -------------------------------------------------------------------------- */
/* PATTERNS                                                                   */
/* -------------------------------------------------------------------------- */

const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];

const PATTERNS = {
  // A bare number needs a space after its label, so "1.08 = charge" in an
  // explanation is not read as question 1.
  question: /^(?:(?:Q(?:uestion|ues)?\s*\.?\s*\d+|Q\s*-\s*\d+)[.:)]\s*|\d+[.:)](?:\s+|$))(.*)$/is,

  option: /^(?:Option\s+)?(?:\(([a-f1-6])\)|\[([a-f1-6])\]|([a-f1-6])\s*[).:])\s*(.*)$/is,

  answer:
    /^(?:(?:Correct\s+)?(?:Ans(?:wer)?)|Correct\s+(?:Answer|Option))\s*[:.\-–]?\s*(?:Option\s*)?\(?\s*([a-f1-6])\s*\)?\s*\.?$/i,

  explanation: /^(?:Explanation|Exp|Sol|Solution|Hint|Reason)\s*[:.\-–]\s*(.*)$/is,
};

// 1 -> a, 2 -> b, etc.
const normalizeOption = (label: string) => {
  const value = label.toLowerCase();

  return /^[1-6]$/.test(value) ? OPTION_LETTERS[Number(value) - 1]! : value;
};

// Labels like "**Q1. **Text" or "**Ans: (d)**" are bolded in some docs,
// which breaks the anchored patterns. Unwrap the leading bold if that helps.
const unwrapBoldPrefix = (line: string) => {
  const match = line.match(/^(\*{1,2})(.*?)\1(.*)$/s);

  if (!match) {
    return line;
  }

  const candidate = (match[2]! + match[3]!).trim();
  const matchesAny = Object.values(PATTERNS).some((pattern) => pattern.test(candidate));

  return matchesAny ? candidate : line;
};

/* -------------------------------------------------------------------------- */
/* BLOCKS                                                                     */
/* -------------------------------------------------------------------------- */

// A paragraph line or a whole table, as markdown, with the indexes of the
// document images it holds.
type Block = {
  text: string;
  images: number[];
};

// Images are emitted by parseQuestionsFromDocx as <img src="docx-image:N">.
const IMAGE_SRC_PATTERN = /^docx-image:(\d+)$/;

// Keeps the formatting the frontend renders: bold, italics and LaTeX-style
// superscripts/subscripts (m/s<sup>2</sup> -> m/s$^{2}$).
const toMarkdown = ($: cheerio.CheerioAPI, node: AnyNode, images: number[]): string => {
  if (node.type === "text") {
    return node.data ?? "";
  }

  if (node.type !== "tag") {
    return "";
  }

  if (node.name === "img") {
    const index = ($(node).attr("src") ?? "").match(IMAGE_SRC_PATTERN)?.[1];

    if (index !== undefined) {
      images.push(Number(index));
    }

    return "";
  }

  const content = node.children.map((child) => toMarkdown($, child, images)).join("");

  // Empty runs would otherwise leave stray "****" behind.
  if (!content.trim() && node.name !== "br") {
    return content;
  }

  switch (node.name) {
    case "strong":
    case "b":
      return `**${content}**`;

    case "em":
    case "i":
      return `*${content}*`;

    case "sub":
      return `$_{${content.trim()}}$`;

    case "sup":
      return `$^{${content.trim()}}$`;

    case "br":
      return "\n";

    case "a": {
      const href = $(node).attr("href");
      return href && !href.startsWith("#") ? `[${content}](${href})` : content;
    }

    default:
      return content;
  }
};

const tidy = (markdown: string) =>
  markdown
    .replace(/[ \t ]+/g, " ")
    // Adjacent runs ("**A****B**") merge.
    .replace(/\*\*\*\*/g, "")
    .trim();

const tableToMarkdown = ($: cheerio.CheerioAPI, table: AnyNode, images: number[]) => {
  const rows: string[][] = [];

  $(table)
    .find("tr")
    .each((_, row) => {
      const cells = $(row)
        .children("th, td")
        .toArray()
        .map((cell) =>
          tidy(toMarkdown($, cell, images).replace(/\s*\n\s*/g, " ")).replace(/\|/g, "\\|"),
        );

      if (cells.some(Boolean)) {
        rows.push(cells);
      }
    });

  if (!rows.length) {
    return "";
  }

  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => row[i] ?? "").join(" | ")} |`;

  return [line(rows[0]!), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
};

const extractBlocks = (html: string): Block[] => {
  const $ = cheerio.load(html);
  const blocks: Block[] = [];

  const visit = (element: AnyNode) => {
    if (element.type !== "tag") {
      return;
    }

    if (element.name === "table") {
      const images: number[] = [];
      const text = tableToMarkdown($, element, images);

      // A table holding only an image (a common way to place a figure) is
      // kept for the image alone.
      if (text || images.length) {
        blocks.push({ text, images });
      }

      return;
    }

    if (element.name === "ol" || element.name === "ul") {
      $(element).children("li").each((_, item) => visit(item));
      return;
    }

    if (!["p", "li", "h1", "h2", "h3", "h4", "h5", "h6"].includes(element.name)) {
      return;
    }

    // Nested lists inside an item are visited on their own.
    const inline = element.children.filter(
      (child) => !(child.type === "tag" && (child.name === "ol" || child.name === "ul")),
    );

    const images: number[] = [];
    const markdown = inline.map((child) => toMarkdown($, child, images)).join("");

    // A <br> splits a paragraph into lines. Images stay with the first line.
    markdown
      .split("\n")
      .map(tidy)
      .forEach((text, index) => {
        if (text || (index === 0 && images.length)) {
          blocks.push({ text, images: index === 0 ? images : [] });
        }
      });

    $(element).children("ol, ul").each((_, list) => visit(list));
  };

  $("body").children().each((_, element) => visit(element));

  return blocks;
};

/* -------------------------------------------------------------------------- */
/* PARSING                                                                    */
/* -------------------------------------------------------------------------- */

type Draft = {
  question: string[];
  // raw keeps the original line in case the option turns out to be stem text.
  options: { label: string; raw: string; text: string[]; images: number[] }[];
  explanation: string[];
  answer: string | null;
  questionImages: number[];
  explanationImages: number[];
};

const plain = (markdown: string) => markdown.replace(/\*+|\$[_^]\{|\}\$/g, "").trim();

const join = (lines: string[]) =>
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");

const validate = (draft: Draft, index: number, images: DocImage[]): ParsedQuestion => {
  const preview = plain(draft.question.find(Boolean) ?? "").slice(0, 80);
  const fail = (error: string): ParsedQuestion => ({ index, preview, error });

  if (!draft.options.length) {
    return fail("No options found");
  }

  if (!draft.answer) {
    return fail('Question has no "Ans:" line');
  }

  if (!draft.options.some((option) => option.label === draft.answer)) {
    return fail(`Answer (${draft.answer}) does not match any option`);
  }

  // The question, each option and the explanation store one image each, so
  // only the first usable one is kept. Formats browsers cannot show (WMF/EMF
  // equations) and oversized images are skipped.
  const pick = (indexes: number[]) =>
    indexes
      .map((i) => images[i]!)
      .find((entry) => isSupportedImage(entry.contentType, entry.buffer.length));

  const image = pick(draft.questionImages);
  const optionImages = draft.options.map((option) => pick(option.images));
  const explanationImage = pick(draft.explanationImages);
  const optionTexts = draft.options.map((option) => option.text.join("\n").trim());

  const parsed = createQuestionSchema.safeParse({
    question: join(draft.question),
    explanation: join(draft.explanation) || undefined,
    isActive: true,
    options: draft.options.map((option, i) => ({
      // An option can be just an image, which the schema would reject as empty.
      text: optionTexts[i] || (optionImages[i] ? "image" : ""),
      isCorrect: option.label === draft.answer,
    })),
  });

  if (!parsed.success) {
    return fail(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "question"}: ${issue.message}`)
        .join(", "),
    );
  }

  parsed.data.options.forEach((option, i) => {
    option.text = optionTexts[i]!;
  });

  return {
    index,
    preview,
    data: parsed.data,
    image,
    optionImages,
    explanationImage,
  };
};

// Each question starts at its numbered line ("Q1.", "1)", "Question 2:"),
// followed by its options, an "Ans: (x)" line and an optional explanation.
export const parseQuestionsFromHtml = (html: string, images: DocImage[] = []): ParsedQuestion[] => {
  const drafts: Draft[] = [];

  let current: Draft | null = null;
  let section: "question" | "options" | "explanation" = "question";

  for (const block of extractBlocks(html)) {
    const line = unwrapBoldPrefix(block.text);
    // Numbered lines before the answer ("1. Statement one") belong to the
    // current question, so a new question only starts once it is answered.
    const questionMatch: RegExpMatchArray | null = !current || current.answer ? line.match(PATTERNS.question) : null;

    if (questionMatch) {
      current = {
        question: [questionMatch[1]!],
        options: [],
        explanation: [],
        answer: null,
        questionImages: [...block.images],
        explanationImages: [],
      };

      drafts.push(current);
      section = "question";
      continue;
    }

    if (!current) {
      continue;
    }

    const answerMatch = line.match(PATTERNS.answer);

    if (answerMatch) {
      current.answer = normalizeOption(answerMatch[1]!);
      current.explanationImages.push(...block.images);
      // Lines after the answer are the explanation, labelled or not.
      section = "explanation";
      continue;
    }

    const explanationMatch = line.match(PATTERNS.explanation);

    if (explanationMatch) {
      current.explanation.push(explanationMatch[1]!);
      current.explanationImages.push(...block.images);
      section = "explanation";
      continue;
    }

    if (section === "question" || section === "options") {
      const optionMatch = line.match(PATTERNS.option);

      if (optionMatch) {
        const label = optionMatch[1] ?? optionMatch[2] ?? optionMatch[3];

        // Statements ("1.", "(a)", "A.") followed by the real "(a)".."(d)"
        // options were part of the question, so a restart moves them back.
        const restarts =
          current.options.length > 0 &&
          (normalizeOption(label!) === "a" ||
            (/[a-f]/i.test(label!) && current.options.some((option) => /^\d/.test(option.raw))));

        if (restarts) {
          current.question.push(...current.options.map((option) => option.raw));
          current.questionImages.push(...current.options.flatMap((option) => option.images));
          current.options = [];
        }

        current.options.push({
          raw: line,
          label: normalizeOption(label!),
          text: [unwrapBoldPrefix(optionMatch[4]!.trim())],
          images: [...block.images],
        });
        section = "options";
        continue;
      }
    }

    // Multiline content continues whatever section came last.
    if (section === "question") {
      current.question.push(line);
      current.questionImages.push(...block.images);
    } else if (section === "options") {
      current.options.at(-1)!.text.push(line);
      current.options.at(-1)!.images.push(...block.images);
    } else if (section === "explanation") {
      current.explanation.push(line);
      current.explanationImages.push(...block.images);
    }
  }

  return drafts.map((draft, i) => validate(draft, i + 1, images));
};

// Docs from converters often omit content types for their media (mammoth then
// reports "application/octet-stream"), so trust the file signature instead.
const detectImageType = (buffer: Buffer): string | null => {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
};

export const parseQuestionsFromDocx = async (buffer: Buffer): Promise<ParsedQuestion[]> => {
  const images: DocImage[] = [];

  // Images are collected instead of inlined as base64; the service saves the
  // ones that end up attached to a question.
  const { value: html } = await mammoth.convertToHtml(
    { buffer: await replaceEquations(buffer) },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageBuffer = await image.readAsBuffer();

        images.push({
          buffer: imageBuffer,
          contentType: detectImageType(imageBuffer) ?? image.contentType,
        });

        return { src: `docx-image:${images.length - 1}` };
      }),
    },
  );

  return parseQuestionsFromHtml(html, images);
};

/* -------------------------------------------------------------------------- */
/* SPREADSHEETS                                                               */
/* -------------------------------------------------------------------------- */

// Header names are matched loosely ("Option A", "option_a", "OptionA").
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

const cellText = (cell: ExcelJS.Cell) => {
  const value = cell.value;

  if (value && typeof value === "object" && "richText" in value) {
    return value.richText.map((run) => run.text).join("").trim();
  }

  return (cell.text ?? "").trim();
};

// One question per row, with columns "Question", "Option A".."Option F",
// "Answer" (a letter) and an optional "Explanation". Other columns are ignored.
export const parseQuestionsFromXlsx = async (buffer: Buffer): Promise<ParsedQuestion[]> => {
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

  const questionColumn = columns.get("question");
  const answerColumn = columns.get("answer");

  if (!questionColumn || !answerColumn) {
    throw new Error('The first row must have "Question" and "Answer" columns');
  }

  const explanationColumn = columns.get("explanation");
  const optionColumns = OPTION_LETTERS.flatMap((letter) => {
    const column = columns.get(`option${letter}`);
    return column ? [{ letter, column }] : [];
  });

  const results: ParsedQuestion[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const read = (column?: number) => (column ? cellText(row.getCell(column)) : "");

    const question = read(questionColumn);
    const answerText = read(answerColumn);

    // Blank rows are skipped rather than reported.
    if (!question && !answerText) {
      continue;
    }

    const index = results.length + 1;
    const preview = question.slice(0, 80);
    const answer = answerText.match(/^\(?\s*([a-f])\s*\)?$/i)?.[1]?.toLowerCase();

    if (!answer) {
      results.push({ index, preview, error: `Row ${rowNumber}: answer must be a letter A-F` });
      continue;
    }

    const options = optionColumns
      .map(({ letter, column }) => ({ letter, text: read(column) }))
      .filter((option) => option.text);

    if (!options.some((option) => option.letter === answer)) {
      results.push({
        index,
        preview,
        error: `Row ${rowNumber}: answer (${answer}) does not match any option`,
      });
      continue;
    }

    const parsed = createQuestionSchema.safeParse({
      question,
      explanation: read(explanationColumn) || undefined,
      isActive: true,
      options: options.map((option) => ({
        text: option.text,
        isCorrect: option.letter === answer,
      })),
    });

    if (!parsed.success) {
      results.push({
        index,
        preview,
        error: `Row ${rowNumber}: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "question"}: ${issue.message}`)
          .join(", ")}`,
      });
      continue;
    }

    results.push({ index, preview, data: parsed.data });
  }

  return results;
};
