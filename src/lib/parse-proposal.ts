import { emptyProposal, uid, type LineItem, type Party, type Proposal } from "./proposal";

type Item = { x: number; y: number; str: string };

export async function extractItems(file: File): Promise<Item[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: Item[] = [];
  let offset = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      if (typeof it.str !== "string" || !it.str.trim()) continue;
      out.push({ x: it.transform[4], y: offset + (page.view[3] - it.transform[5]), str: it.str.trim() });
    }
    offset += page.view[3];
  }
  return out;
}

type Row = { y: number; cells: Item[]; text: string };

function toRows(items: Item[]): Row[] {
  const buckets = new Map<number, Item[]>();
  for (const it of items) {
    const key = Math.round(it.y / 4);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(it);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, cells]) => {
      cells.sort((a, b) => a.x - b.x);
      return { y: k * 4, cells, text: cells.map((c) => c.str).join(" ").replace(/\s+/g, " ").trim() };
    });
}

const num = (s: string) => Number(String(s).replace(/[^0-9.\-]/g, "")) || 0;

function valueAfter(rows: Row[], label: string): string {
  for (const r of rows) {
    const idx = r.cells.findIndex((c) => c.str.replace(/:$/, "").toLowerCase() === label.toLowerCase());
    if (idx >= 0 && r.cells[idx + 1]) return r.cells[idx + 1]!.str;
  }
  return "";
}

/** Column-aware parser tuned for the "Sales Proposal" template layout. */
export function itemsToProposal(items: Item[]): Proposal {
  const p = emptyProposal();
  const rows = toRows(items);
  const all = rows.map((r) => r.text);

  const titleRow = all.find((t) => /sales proposal/i.test(t)) || "";
  p.proposalNumber = (titleRow.match(/sales proposal\s*#?\s*([\w-]+)/i)?.[1] ?? "").trim();
  const headerRow = rows.find((r) => /sales proposal/i.test(r.text));
  if (headerRow) {
    const rightMost = headerRow.cells[headerRow.cells.length - 1];
    if (rightMost && !/sales proposal|\d{3,}/i.test(rightMost.str)) p.vendorName = rightMost.str;
  }

  p.date = valueAfter(rows, "Date") || p.date;
  p.terms = valueAfter(rows, "Terms");
  p.so = valueAfter(rows, "SO") || "0";
  const validRow = rows.find((r) => /valid for/i.test(r.text));
  if (validRow) {
    const i = validRow.cells.findIndex((c) => /valid/i.test(c.str));
    p.validFor = validRow.cells
      .slice(i + 1)
      .map((c) => c.str)
      .join(" ")
      .replace(/for\s*/i, "")
      .replace(/\bSO\b.*$/i, "")
      .trim();
  }

  // Address blocks: split by the x position of the Customer / Ship To / Proposal By headings.
  const headRow = rows.find((r) => /customer/i.test(r.text) && /ship to/i.test(r.text));
  const itemsHead = rows.findIndex((r) => /qty/i.test(r.text) && /(unit price|extended)/i.test(r.text));
  if (headRow) {
    const xs = ["customer", "ship to", "proposal by"].map(
      (label) => headRow.cells.find((c) => c.str.toLowerCase().startsWith(label.split(" ")[0]!))?.x ?? 0,
    );
    const bounds = [
      [xs[0]! - 40, xs[1]! - 40],
      [xs[1]! - 40, xs[2]! - 40],
      [xs[2]! - 40, Infinity],
    ];
    const startY = headRow.y;
    const endY = itemsHead >= 0 ? rows[itemsHead]!.y : Infinity;
    const parties: Party[] = bounds.map(([lo, hi]) => {
      const lines: string[] = [];
      let attn = "";
      const emails: string[] = [];
      for (const r of rows) {
        if (r.y <= startY || r.y >= endY) continue;
        const cells = r.cells.filter((c) => c.x >= lo! && c.x < hi!);
        if (!cells.length) continue;
        const text = cells.map((c) => c.str).join(" ").replace(/\s+/g, " ").trim();
        if (/^attn\s*:?/i.test(text)) attn = text.replace(/^attn\s*:?\s*/i, "");
        else if (/^email\s*:?/i.test(text)) emails.push(text.replace(/^email\s*:?\s*/i, ""));
        else if (/@/.test(text) && emails.length) emails.push(text);
        else lines.push(text);
      }
      return {
        name: lines[0] ?? "",
        address: lines.slice(1).join("\n"),
        attn,
        email: emails.join(" "),
      };
    });
    p.customer = parties[0]!;
    p.shipTo = parties[1]!;
    p.proposalBy = parties[2]!;
    if (!p.vendorName) p.vendorName = p.proposalBy.name;
  }

  // Line items
  if (itemsHead >= 0) {
    const head = rows[itemsHead]!;
    const colX = (label: string) =>
      head.cells.find((c) => c.str.toLowerCase().startsWith(label))?.x ?? Infinity;
    const xQty = colX("qty");
    const xDesc = colX("desc");
    const xMfgr = colX("mfgr");
    const parsed: LineItem[] = [];
    for (const r of rows.slice(itemsHead + 1)) {
      if (/total sale|your price|currency totals|full name|signature/i.test(r.text)) break;
      const nums = r.cells.filter((c) => c.x >= xQty - 20 && /^[\d,]+(\.\d+)?$/.test(c.str));
      const lead = r.cells.filter((c) => c.x < xMfgr - 20).map((c) => c.str);
      const mfgr = r.cells.filter((c) => c.x >= xMfgr - 20 && c.x < xDesc - 20).map((c) => c.str).join(" ");
      const desc = r.cells.filter((c) => c.x >= xDesc - 20 && c.x < xQty - 20).map((c) => c.str).join(" ");
      const isNew = /^\d{3,4}$/.test(lead[0] ?? "") && nums.length >= 3;
      if (isNew) {
        parsed.push({
          id: uid(),
          line: lead[0]!,
          item: lead.slice(1).join(" "),
          mfgr,
          description: desc,
          qty: num(nums[0]!.str),
          listPrice: num(nums[1]!.str),
          discPct: num(nums[2]!.str),
          unitPrice: num(nums[3]?.str ?? "0"),
        });
      } else if (parsed.length && desc) {
        parsed[parsed.length - 1]!.description += ` ${desc}`;
      }
    }
    if (parsed.length) p.items = parsed;
  }

  const freightRow = all.find((t) => /freight/i.test(t));
  if (freightRow) p.freight = num(freightRow.replace(/freight/i, ""));
  const currency = all.find((t) => /currency totals/i.test(t));
  if (currency) p.currencyNote = currency;
  const footer = all.find((t) => /purchase order/i.test(t) && t.length > 40);
  if (footer) p.footerNote = footer;

  return p;
}

export async function parseProposalPdf(file: File) {
  const items = await extractItems(file);
  return itemsToProposal(items);
}
