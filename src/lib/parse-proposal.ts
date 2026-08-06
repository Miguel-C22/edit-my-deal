import { emptyProposal, uid, type Proposal } from "./proposal";

/** Extract text lines from a PDF file, in reading order. */
export async function extractLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  // Worker is bundled by Vite as a module worker URL.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      if (typeof item.str !== "string" || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: item.transform[4], str: item.str });
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, parts]) => {
        const line = parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (line) lines.push(line);
      });
  }
  return lines;
}

const num = (s: string) => Number(s.replace(/[^0-9.\-]/g, "")) || 0;

function findAfter(lines: string[], labels: string[]): string {
  for (const line of lines) {
    for (const label of labels) {
      const re = new RegExp(`${label}\\s*[:#]?\\s*(.+)$`, "i");
      const m = line.match(re);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return "";
}

/** Best-effort mapping of raw PDF lines onto the proposal model. */
export function linesToProposal(lines: string[]): Proposal {
  const p = emptyProposal();
  const joined = lines.join("\n");

  p.title = lines[0]?.slice(0, 80) || p.title;
  p.companyName = lines.find((l) => /(inc\.?|llc|ltd|co\.|company|group|studio)\b/i.test(l)) || "";
  p.clientName = findAfter(lines, ["prepared for", "client", "bill to", "customer", "to"]);
  p.proposalNumber = findAfter(lines, ["proposal (?:no|number|#)", "quote (?:no|number|#)", "invoice (?:no|number|#)", "proposal"]).slice(0, 40);
  p.date = findAfter(lines, ["date", "issued"]) || p.date;
  p.validUntil = findAfter(lines, ["valid until", "expires", "expiry", "due"]);
  p.currency = /€/.test(joined) ? "€" : /£/.test(joined) ? "£" : "$";

  const taxLine = lines.find((l) => /\b(tax|vat|gst)\b/i.test(l));
  const taxPct = taxLine?.match(/(\d+(?:\.\d+)?)\s*%/);
  if (taxPct) p.taxRate = Number(taxPct[1]);

  // Line items: rows containing a description followed by qty and money amounts.
  const items: Proposal["items"] = [];
  const moneyRe = /[$€£]?\s?\d[\d,]*\.\d{2}/g;
  for (const line of lines) {
    if (/^(subtotal|total|tax|vat|gst|discount|balance|amount due)/i.test(line)) continue;
    const amounts = line.match(moneyRe);
    if (!amounts || amounts.length === 0) continue;
    const desc = line.slice(0, line.indexOf(amounts[0])).trim();
    if (!desc || desc.length < 2) continue;
    const qtyMatch = desc.match(/(?:^|\s)(\d{1,4})(?:\s*(?:x|units?|hrs?|hours?))?\s*$/i);
    const quantity = qtyMatch ? Number(qtyMatch[1]) : 1;
    const description = (qtyMatch ? desc.slice(0, qtyMatch.index).trim() : desc).replace(/[|\-–:]+$/, "").trim();
    if (!description) continue;
    const unitPrice = num(amounts[0]);
    items.push({ id: uid(), description, quantity, unitPrice });
  }
  if (items.length) p.items = items;

  const notesIdx = lines.findIndex((l) => /^(notes?|scope|summary|overview)\b/i.test(l));
  if (notesIdx >= 0) p.notes = lines.slice(notesIdx + 1, notesIdx + 6).join(" ");
  const termsIdx = lines.findIndex((l) => /^(terms|payment terms|conditions)\b/i.test(l));
  if (termsIdx >= 0) p.terms = lines.slice(termsIdx + 1, termsIdx + 6).join(" ");

  return p;
}

export async function parseProposalPdf(file: File) {
  const lines = await extractLines(file);
  return { proposal: linesToProposal(lines), lines };
}
