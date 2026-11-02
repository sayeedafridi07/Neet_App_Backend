import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import JSZip from "jszip";

// Word's built-in equations (OMML) are dropped by mammoth, so they are turned
// into LaTeX text ($...$) inside the document before it is converted. The
// frontend renders $...$ the same way as the superscripts and subscripts.

/* -------------------------------------------------------------------------- */
/* SYMBOLS                                                                    */
/* -------------------------------------------------------------------------- */

const SYMBOLS: Record<string, string> = {
  "×": "\\times ",
  "÷": "\\div ",
  "·": "\\cdot ",
  "⋅": "\\cdot ",
  "−": "-",
  "±": "\\pm ",
  "∓": "\\mp ",
  "≤": "\\le ",
  "≥": "\\ge ",
  "≠": "\\ne ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "∝": "\\propto ",
  "∞": "\\infty ",
  "→": "\\rightarrow ",
  "←": "\\leftarrow ",
  "↔": "\\leftrightarrow ",
  "⇒": "\\Rightarrow ",
  "⟹": "\\Longrightarrow ",
  "⟶": "\\longrightarrow ",
  "∙": "\\cdot ",
  "⇌": "\\rightleftharpoons ",
  "⇋": "\\leftrightharpoons ",
  "↑": "\\uparrow ",
  "↓": "\\downarrow ",
  "°": "^{\\circ}",
  "′": "'",
  "∆": "\\Delta ",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  "∠": "\\angle ",
  "⊥": "\\perp ",
  "∥": "\\parallel ",
  "∈": "\\in ",
  "∴": "\\therefore ",
  "∵": "\\because ",
  "…": "\\ldots ",
  "⋯": "\\cdots ",
  "α": "\\alpha ",
  "β": "\\beta ",
  "γ": "\\gamma ",
  "δ": "\\delta ",
  "ε": "\\varepsilon ",
  "ϵ": "\\epsilon ",
  "ζ": "\\zeta ",
  "η": "\\eta ",
  "θ": "\\theta ",
  "ϑ": "\\vartheta ",
  "ι": "\\iota ",
  "κ": "\\kappa ",
  "λ": "\\lambda ",
  "μ": "\\mu ",
  "ν": "\\nu ",
  "ξ": "\\xi ",
  "π": "\\pi ",
  "ρ": "\\rho ",
  "σ": "\\sigma ",
  "τ": "\\tau ",
  "υ": "\\upsilon ",
  "φ": "\\phi ",
  "ϕ": "\\phi ",
  "χ": "\\chi ",
  "ψ": "\\psi ",
  "ω": "\\omega ",
  "Γ": "\\Gamma ",
  "Δ": "\\Delta ",
  "Θ": "\\Theta ",
  "Λ": "\\Lambda ",
  "Ξ": "\\Xi ",
  "Π": "\\Pi ",
  "Σ": "\\Sigma ",
  "Φ": "\\Phi ",
  "Ψ": "\\Psi ",
  "Ω": "\\Omega ",
  "ℏ": "\\hbar ",
  "Å": "\\text{Å}",
  "{": "\\{",
  "}": "\\}",
  "%": "\\%",
  "#": "\\#",
  "&": "\\&",
  "$": "\\$",
  "\\": "\\backslash ",
  " ": " ",
};

const escapeText = (text: string) =>
  [...text].map((char) => SYMBOLS[char] ?? char).join("");

// Text set in upright type (sty="p" or m:nor) is a function name or a word.
const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "cosec",
  "sinh", "cosh", "tanh", "log", "ln", "exp", "lim", "max", "min",
]);

const NARY: Record<string, string> = {
  "∑": "\\sum",
  "∏": "\\prod",
  "∫": "\\int",
  "∬": "\\iint",
  "∭": "\\iiint",
  "∮": "\\oint",
  "⋃": "\\bigcup",
  "⋂": "\\bigcap",
};

const ACCENTS: Record<string, string> = {
  "̂": "\\hat",
  "̃": "\\tilde",
  "̄": "\\bar",
  "̅": "\\bar",
  "̇": "\\dot",
  "̈": "\\ddot",
  "⃗": "\\vec",
  "⃖": "\\overleftarrow",
  "⃡": "\\overleftrightarrow",
  "̌": "\\check",
  "̆": "\\breve",
};

const DELIMITERS: Record<string, string> = {
  "(": "(",
  ")": ")",
  "[": "[",
  "]": "]",
  "{": "\\{",
  "}": "\\}",
  "|": "|",
  "‖": "\\|",
  "⟨": "\\langle",
  "⟩": "\\rangle",
  "⌊": "\\lfloor",
  "⌋": "\\rfloor",
  "⌈": "\\lceil",
  "⌉": "\\rceil",
  "": ".",
};

/* -------------------------------------------------------------------------- */
/* CONVERSION                                                                 */
/* -------------------------------------------------------------------------- */

const isElement = (node: AnyNode): node is Element => node.type === "tag";

const childrenOf = (node: Element) => node.children.filter(isElement);

const child = (node: Element, name: string) => childrenOf(node).find((entry) => entry.name === name);

const childrenNamed = (node: Element, name: string) =>
  childrenOf(node).filter((entry) => entry.name === name);

// A property such as <m:chr m:val="∑"/> inside <m:naryPr>.
const prop = (node: Element, prName: string, name: string) =>
  child(child(node, prName) ?? node, name)?.attribs["m:val"];

const textOf = (node: Element): string =>
  node.children
    .map((entry) => (entry.type === "text" ? entry.data : isElement(entry) ? textOf(entry) : ""))
    .join("");

// Braces are only needed around more than one character.
const group = (latex: string) => (latex.length === 1 ? latex : `{${latex}}`);

const convertRun = (node: Element) => {
  const text = childrenOf(node)
    .filter((entry) => entry.name === "m:t" || entry.name === "w:t")
    .map(textOf)
    .join("");

  if (!text) {
    return "";
  }

  const rPr = child(node, "m:rPr");
  const upright = rPr && (child(rPr, "m:nor") || prop(node, "m:rPr", "m:sty") === "p");
  const trimmed = text.trim();

  // "cosθ" or "cos120" typed as plain text.
  const fn = upright && trimmed.match(/^([a-z]+)(?![a-z])(.*)$/i);

  if (fn && FUNCTIONS.has(fn[1]!)) {
    return `\\${fn[1] === "cosec" ? "csc" : fn[1]} ${escapeText(fn[2]!)}`;
  }

  if (upright && /[a-z]{2,}/i.test(trimmed)) {
    return `\\text{${text.replace(/[{}\\$%#&]/g, "")}}`;
  }

  return escapeText(text);
};

const convertAll = (nodes: AnyNode[]): string => nodes.filter(isElement).map(convert).join("");

const arg = (node: Element, name: string) => {
  const entry = child(node, name);
  return entry ? convertAll(entry.children) : "";
};

const convert = (node: Element): string => {
  switch (node.name) {
    case "m:r":
    case "w:r":
      return convertRun(node);

    case "m:f": {
      const num = arg(node, "m:num");
      const den = arg(node, "m:den");
      const type = prop(node, "m:fPr", "m:type");

      if (type === "lin") {
        return `${group(num)}/${group(den)}`;
      }

      if (type === "noBar") {
        return `\\genfrac{}{}{0pt}{}{${num}}{${den}}`;
      }

      return `\\frac{${num}}{${den}}`;
    }

    case "m:sSup":
      return `${group(arg(node, "m:e"))}^{${arg(node, "m:sup")}}`;

    case "m:sSub":
      return `${group(arg(node, "m:e"))}_{${arg(node, "m:sub")}}`;

    case "m:sSubSup":
      return `${group(arg(node, "m:e"))}_{${arg(node, "m:sub")}}^{${arg(node, "m:sup")}}`;

    case "m:sPre":
      return `{}_{${arg(node, "m:sub")}}^{${arg(node, "m:sup")}}${group(arg(node, "m:e"))}`;

    case "m:rad": {
      const degree = arg(node, "m:deg");
      const hidden = prop(node, "m:radPr", "m:degHide");

      return degree && hidden !== "1" && hidden !== "on"
        ? `\\sqrt[${degree}]{${arg(node, "m:e")}}`
        : `\\sqrt{${arg(node, "m:e")}}`;
    }

    case "m:d": {
      const begin = prop(node, "m:dPr", "m:begChr") ?? "(";
      const end = prop(node, "m:dPr", "m:endChr") ?? ")";
      const separator = prop(node, "m:dPr", "m:sepChr") ?? "|";
      const content = childrenNamed(node, "m:e")
        .map((entry) => convertAll(entry.children))
        .join(escapeText(separator));

      return `\\left${DELIMITERS[begin] ?? escapeText(begin)}${content}\\right${DELIMITERS[end] ?? escapeText(end)}`;
    }

    case "m:nary": {
      const symbol = prop(node, "m:naryPr", "m:chr") ?? "∫";
      const sub = arg(node, "m:sub");
      const sup = arg(node, "m:sup");

      return (
        (NARY[symbol] ?? escapeText(symbol)) +
        (sub ? `_{${sub}}` : "") +
        (sup ? `^{${sup}}` : "") +
        ` ${group(arg(node, "m:e"))}`
      );
    }

    case "m:acc": {
      const symbol = prop(node, "m:accPr", "m:chr") ?? "̂";
      return `${ACCENTS[symbol] ?? "\\hat"}{${arg(node, "m:e")}}`;
    }

    case "m:bar":
      return prop(node, "m:barPr", "m:pos") === "bot"
        ? `\\underline{${arg(node, "m:e")}}`
        : `\\overline{${arg(node, "m:e")}}`;

    case "m:func":
      return `${arg(node, "m:fName")}${group(arg(node, "m:e"))}`;

    case "m:limLow": {
      const base = arg(node, "m:e");
      const limit = arg(node, "m:lim");

      return /\\lim/.test(base) ? `${base.trim()}_{${limit}}` : `\\underset{${limit}}{${base}}`;
    }

    case "m:limUpp":
      return `\\overset{${arg(node, "m:lim")}}{${arg(node, "m:e")}}`;

    case "m:groupChr": {
      const symbol = prop(node, "m:groupChrPr", "m:chr") ?? "⏟";
      const top = prop(node, "m:groupChrPr", "m:pos") === "top";
      const base = arg(node, "m:e");

      if (symbol === "⏟") return `\\underbrace{${base}}`;
      if (symbol === "⏞") return `\\overbrace{${base}}`;

      const mark = escapeText(symbol).trim();
      return top ? `\\overset{${mark}}{${base}}` : `\\underset{${mark}}{${base}}`;
    }

    case "m:borderBox":
      return `\\boxed{${arg(node, "m:e")}}`;

    case "m:eqArr":
      return `\\begin{aligned}${childrenNamed(node, "m:e")
        .map((entry) => convertAll(entry.children))
        .join(" \\\\ ")}\\end{aligned}`;

    case "m:m":
      return `\\begin{matrix}${childrenNamed(node, "m:mr")
        .map((row) =>
          childrenNamed(row, "m:e")
            .map((entry) => convertAll(entry.children))
            .join(" & "),
        )
        .join(" \\\\ ")}\\end{matrix}`;

    // Properties hold formatting only.
    case "m:ctrlPr":
    case "w:rPr":
      return "";

    default:
      return node.name.endsWith("Pr") ? "" : convertAll(node.children);
  }
};

export const ommlToLatex = (node: Element) =>
  convert(node)
    .replace(/\s+/g, " ")
    .trim();

/* -------------------------------------------------------------------------- */
/* DOCUMENT                                                                   */
/* -------------------------------------------------------------------------- */

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const latexRun = (latex: string) =>
  latex ? `<w:r><w:t xml:space="preserve">$${escapeXml(latex)}$</w:t></w:r>` : "";

// Rewrites the main document so every equation is a plain run of "$latex$".
// Documents without equations are returned unchanged.
export const replaceEquations = async (buffer: Buffer): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");

  if (!entry) {
    return buffer;
  }

  const xml = await entry.async("string");

  if (!xml.includes("<m:oMath")) {
    return buffer;
  }

  const $ = cheerio.load(xml, { xml: true });

  const replace = (node: Element, latex: string) => {
    $(node).replaceWith(latexRun(latex));
  };

  // A display equation (oMathPara) can hold several equations.
  $("m\\:oMathPara").each((_, node) => {
    const latex = childrenNamed(node, "m:oMath")
      .map(ommlToLatex)
      .filter(Boolean)
      .join(" \\quad ");

    replace(node, latex);
  });

  $("m\\:oMath").each((_, node) => {
    replace(node, ommlToLatex(node));
  });

  zip.file("word/document.xml", $.xml());

  return zip.generateAsync({ type: "nodebuffer" });
};
