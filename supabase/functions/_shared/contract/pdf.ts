import { PDFDocument, type PDFFont, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import type { ContractFields } from "./fields.ts";

/**
 * Stamps booking values onto the rental-agreement template
 * (`rental-agreement-en.template.pdf`, built by scripts/contract/prepare-template.py).
 *
 * Coordinates are PDF points (origin bottom-left) measured from the template; `y` is
 * the text baseline of the matching label so values line up with it.
 *
 * Values use Arimo (metric-compatible with the template's Helvetica, OFL-1.1) so
 * names outside Latin-1 (e.g. "Łukasz") are printed exactly as given.
 */

interface Slot {
  page: number;
  x: number;
  y: number;
  /** Right edge the text must not cross. */
  maxX: number;
}

const LEFT_COLUMN_END = 298;
const RIGHT_COLUMN_END = 538;

export const CONTRACT_FIELD_SLOTS: Record<keyof ContractFields, Slot> = {
  renterName: { page: 0, x: 98, y: 733.4, maxX: LEFT_COLUMN_END },
  renterPhone: { page: 0, x: 342, y: 733.4, maxX: RIGHT_COLUMN_END },
  renterAddress: { page: 0, x: 111, y: 707.4, maxX: RIGHT_COLUMN_END },
  renterPostalCode: { page: 0, x: 128, y: 681.4, maxX: LEFT_COLUMN_END },
  renterCity: { page: 0, x: 330, y: 681.4, maxX: RIGHT_COLUMN_END },
  make: { page: 0, x: 95, y: 567.4, maxX: LEFT_COLUMN_END },
  agreedDuration: { page: 0, x: 150, y: 453.4, maxX: LEFT_COLUMN_END },
  timeOfHandover: { page: 0, x: 157, y: 427.4, maxX: LEFT_COLUMN_END },
  timeOfReturn: { page: 0, x: 157, y: 401.4, maxX: LEFT_COLUMN_END },
  agreedRent: { page: 0, x: 176.9, y: 263.4, maxX: LEFT_COLUMN_END },
  otherCharge: { page: 0, x: 176.9, y: 197.4, maxX: LEFT_COLUMN_END },
  deposit: { page: 0, x: 423.5, y: 223.4, maxX: RIGHT_COLUMN_END },
  total: { page: 0, x: 176.9, y: 171.4, maxX: LEFT_COLUMN_END },
  paymentMethod: { page: 0, x: 423.5, y: 171.4, maxX: RIGHT_COLUMN_END },
  renterSignatureDate: { page: 1, x: 92, y: 751.4, maxX: 172 },
};

const FONT_SIZE = 10.5;
const MIN_FONT_SIZE = 7;
const TEXT_COLOR = rgb(0, 0, 0);

export type ContractRenderErrorCode = "CONTRACT_FIELD_TOO_LONG" | "CONTRACT_UNSUPPORTED_CHARACTER" | "CONTRACT_TEMPLATE_MISMATCH";

export class ContractRenderError extends Error {
  constructor(readonly code: ContractRenderErrorCode, readonly field?: keyof ContractFields) {
    super(code);
    this.name = "ContractRenderError";
  }
}

/**
 * Replaces control characters with spaces and maps glyphs the font lacks to their
 * unaccented base letter. If a character still can't be printed the contract is not
 * generated: silently altering a party's name on a legal document is not acceptable.
 */
export function toPrintable(supported: ReadonlySet<number>, value: string, field: keyof ContractFields): string {
  let out = "";
  // deno-lint-ignore no-control-regex -- replacing control characters is the point.
  for (const ch of value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ")) {
    if (supported.has(ch.codePointAt(0)!)) {
      out += ch;
      continue;
    }
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (base && base !== ch && [...base].every((c) => supported.has(c.codePointAt(0)!))) {
      out += base;
      continue;
    }
    throw new ContractRenderError("CONTRACT_UNSUPPORTED_CHARACTER", field);
  }
  return out;
}

/** Shrinks the font until the text fits; truncation is never acceptable on a contract. */
function fitFontSize(font: PDFFont, text: string, maxWidth: number, field: keyof ContractFields): number {
  let size = FONT_SIZE;
  while (size > MIN_FONT_SIZE && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  if (font.widthOfTextAtSize(text, size) > maxWidth) {
    throw new ContractRenderError("CONTRACT_FIELD_TOO_LONG", field);
  }
  return size;
}

export interface ContractAssets {
  template: Uint8Array;
  font: Uint8Array;
}

export interface RenderContractOptions {
  title: string;
}

export async function renderContractPdf(
  assets: ContractAssets,
  fields: ContractFields,
  options: RenderContractOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.load(assets.template, { updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(assets.font, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const pages = pdf.getPages();

  for (const key of Object.keys(CONTRACT_FIELD_SLOTS) as Array<keyof ContractFields>) {
    const value = fields[key];
    if (!value) continue;
    const slot = CONTRACT_FIELD_SLOTS[key];
    const page = pages[slot.page];
    if (!page) throw new ContractRenderError("CONTRACT_TEMPLATE_MISMATCH", key);

    const text = toPrintable(supported, value, key);
    const size = fitFontSize(font, text, slot.maxX - slot.x, key);
    page.drawText(text, { x: slot.x, y: slot.y, size, font, color: TEXT_COLOR });
  }

  pdf.setTitle(options.title);
  pdf.setAuthor("Prime Norge AS");
  pdf.setSubject("Rental Agreement");
  pdf.setProducer("Prime Norge AS");
  pdf.setCreator("Prime Norge AS booking");

  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}

/** Loads the bundled template and font. Paths must match `static_files` in supabase/config.toml. */
export async function loadContractAssets(): Promise<ContractAssets> {
  const [template, font] = await Promise.all([
    Deno.readFile(new URL("./rental-agreement-en.template.pdf", import.meta.url)),
    Deno.readFile(new URL("./fonts/Arimo-Regular.ttf", import.meta.url)),
  ]);
  return { template, font };
}
