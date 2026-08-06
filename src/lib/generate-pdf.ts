import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { money, totals, type Proposal } from "./proposal";

const INK: [number, number, number] = [22, 30, 42];
const MUTED: [number, number, number] = [110, 122, 138];
const ACCENT: [number, number, number] = [193, 122, 47];

export function generateProposalPdf(p: Proposal) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(p.title || "Sales Proposal", M, y);

  y += 18;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(2);
  doc.line(M, y, M + 64, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const metaRight = [
    p.proposalNumber && `Proposal #${p.proposalNumber}`,
    p.date && `Date: ${p.date}`,
    p.validUntil && `Valid until: ${p.validUntil}`,
  ].filter(Boolean) as string[];
  metaRight.forEach((line, i) => doc.text(line, W - M, 46 + i * 13, { align: "right" }));

  y += 26;
  const colW = (W - M * 2 - 24) / 2;
  const block = (label: string, name: string, details: string, x: number) => {
    let by = y;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, by);
    by += 14;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(name || "—", x, by);
    by += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(details || "", colW), x, by);
    return by + doc.splitTextToSize(details || "", colW).length * 12;
  };
  const y1 = block("From", p.companyName, p.companyDetails, M);
  const y2 = block("Prepared for", p.clientName, p.clientDetails, M + colW + 24);
  y = Math.max(y1, y2) + 18;

  if (p.customFields.length) {
    doc.setFontSize(9);
    p.customFields.forEach((f, i) => {
      const x = i % 2 === 0 ? M : M + colW + 24;
      if (i % 2 === 0 && i > 0) y += 14;
      doc.setTextColor(...MUTED);
      doc.text(`${f.label}: `, x, y);
      doc.setTextColor(...INK);
      doc.text(f.value || "—", x + doc.getTextWidth(`${f.label}: `), y);
    });
    y += 24;
  }

  const t = totals(p);
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Amount"]],
    body: p.items.map((i) => [
      i.description,
      String(i.quantity),
      money(i.unitPrice, p.currency),
      money(i.quantity * i.unitPrice, p.currency),
    ]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: INK },
    headStyles: { fontStyle: "bold", fontSize: 8, textColor: MUTED, lineWidth: { bottom: 1 }, lineColor: [220, 224, 230] },
    bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: [235, 238, 242] },
    columnStyles: {
      1: { halign: "right", cellWidth: 50 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 100 },
    },
    margin: { left: M, right: M },
  });

  y = (doc as any).lastAutoTable.finalY + 18;
  const rows: [string, string, boolean?][] = [
    ["Subtotal", money(t.subtotal, p.currency)],
    ...(t.discount ? ([["Discount", `-${money(t.discount, p.currency)}`]] as [string, string][]) : []),
    ...(p.taxRate ? ([[`Tax (${p.taxRate}%)`, money(t.tax, p.currency)]] as [string, string][]) : []),
    ["Total", money(t.total, p.currency), true],
  ];
  rows.forEach(([label, val, strong]) => {
    doc.setFont("helvetica", strong ? "bold" : "normal");
    doc.setFontSize(strong ? 13 : 10);
    doc.setTextColor(...(strong ? INK : MUTED));
    doc.text(label, W - M - 130, y, { align: "right" });
    doc.setTextColor(...INK);
    doc.text(val, W - M, y, { align: "right" });
    y += strong ? 24 : 16;
  });

  const section = (title: string, body: string) => {
    if (!body.trim()) return;
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(title.toUpperCase(), M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(body, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 13;
  };
  section("Notes", p.notes);
  section("Terms", p.terms);

  const name = `${(p.clientName || "proposal").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-proposal.pdf`;
  doc.save(name);
}
