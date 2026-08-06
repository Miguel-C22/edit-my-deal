import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { extended, money, totals, type Party, type Proposal } from "./proposal";

const INK: [number, number, number] = [0, 0, 0];
const BLUE: [number, number, number] = [21, 76, 160];
const GREY: [number, number, number] = [217, 217, 217];
const LINE: [number, number, number] = [130, 130, 130];

export function buildProposalDoc(p: Proposal) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  const right = W - M;

  // ---- Header -------------------------------------------------------
  if (p.logo) {
    try {
      doc.addImage(p.logo, "PNG", M, 26, 150, 44);
    } catch {
      /* ignore unsupported image */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(`Sales Proposal ${p.proposalNumber}`.trim(), W / 2, 50, { align: "center" });
  doc.setFontSize(13);
  doc.text(p.vendorName || "", right, 50, { align: "right" });

  // ---- Meta row -----------------------------------------------------
  const meta: [string, string][] = [
    ["Date", p.date],
    ["Terms", p.terms],
    ["Valid for", p.validFor],
    ["SO", p.so],
  ];
  const metaY = 100;
  const colStep = (W - M * 2) / 4;
  meta.forEach(([label, value], i) => {
    const x = M + 30 + i * colStep;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, x, metaY, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(value || "", x + 12, metaY);
  });

  // ---- Party blocks --------------------------------------------------
  const boxY = 118;
  const boxW = (W - M * 2) / 3;
  const headH = 18;
  const bodyH = 118;
  const attnH = 60;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.setFillColor(...GREY);
  doc.rect(M, boxY, boxW * 3, headH, "FD");
  ["Customer", "Ship To", "Proposal By"].forEach((t, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(t, M + boxW * i + boxW / 2, boxY + 12.5, { align: "center" });
    if (i > 0) doc.line(M + boxW * i, boxY, M + boxW * i, boxY + headH + bodyH + attnH);
  });
  doc.rect(M, boxY + headH, boxW * 3, bodyH);
  doc.rect(M, boxY + headH + bodyH, boxW * 3, attnH);

  const drawParty = (party: Party, i: number) => {
    const x = M + boxW * i + 8;
    const maxW = boxW - 16;
    let y = boxY + headH + 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = [party.name, ...party.address.split("\n")].filter((l) => l !== undefined);
    for (const l of lines.slice(0, 6)) {
      doc.text(doc.splitTextToSize(l || "", maxW)[0] ?? "", x, y);
      y += 14;
    }
    let ay = boxY + headH + bodyH + 16;
    if (party.attn) {
      doc.text("Attn:", x, ay);
      doc.text(doc.splitTextToSize(party.attn, maxW - 44), x + 44, ay);
      ay += 12;
    }
    if (party.email) {
      doc.text("Email:", x, ay);
      const em = doc.splitTextToSize(party.email, maxW - 44);
      doc.text(em, x + 44, ay);
    }
  };
  drawParty(p.customer, 0);
  drawParty(p.shipTo, 1);
  drawParty(p.proposalBy, 2);

  let y = boxY + headH + bodyH + attnH + 26;

  // ---- Custom fields --------------------------------------------------
  if (p.customFields.length) {
    doc.setFontSize(9);
    p.customFields.forEach((f, i) => {
      const x = M + (i % 3) * boxW;
      if (i % 3 === 0 && i > 0) y += 14;
      doc.setFont("helvetica", "bold");
      doc.text(`${f.label}:`, x, y);
      doc.setFont("helvetica", "normal");
      doc.text(f.value || "", x + doc.getTextWidth(`${f.label}: `) + 4, y);
    });
    y += 22;
  }

  // ---- Items table -----------------------------------------------------
  autoTable(doc, {
    startY: y,
    head: [["Line", "Item", "Mfgr", "Description", "Qty", "List Price", "Disc %", "Unit Price", "Extended"]],
    body: p.items.flatMap((i) => [
      [
        i.line,
        i.item,
        i.mfgr,
        i.description,
        String(i.qty),
        money(i.listPrice),
        money(i.discPct),
        money(i.unitPrice),
        money(extended(i)),
      ],
      ...(i.subLines ?? []).map((s) => [
        "",
        `   ${s.item}`,
        s.mfgr,
        s.description,
        String(s.qty),
        money(s.listPrice),
        money(s.discPct),
        money(s.unitPrice),
        money(extended(s)),
      ]),
    ]),

    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 2, right: 2 }, textColor: INK },
    headStyles: {
      fontStyle: "bold",
      fontSize: 8.5,
      textColor: BLUE,
      lineWidth: { bottom: 0.8 },
      lineColor: LINE,
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 90 },
      2: { cellWidth: 55 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 50 },
      6: { halign: "right", cellWidth: 36 },
      7: { halign: "right", cellWidth: 56 },
      8: { halign: "right", cellWidth: 62 },
    },
    margin: { left: M, right: M },
  });

  y = (doc as any).lastAutoTable.finalY;

  // ---- Totals block -----------------------------------------------------
  const t = totals(p);
  const totalRows: [string, string, boolean][] = [
    ["Total Sale", money(t.totalSale), true],
    ["Freight", money(t.freight), false],
    ["Your Price", `$ ${money(t.yourPrice)}`, true],
  ];
  const blockW = 260;
  const rowH = 16;
  const blockX = right - blockW;
  doc.setFillColor(...GREY);
  doc.rect(blockX, y, blockW, rowH * totalRows.length, "F");
  totalRows.forEach(([label, value, bold], i) => {
    const ry = y + rowH * i + 11.5;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(label, blockX + blockW - 100, ry, { align: "right" });
    doc.text(value, right - 4, ry, { align: "right" });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(blockX + blockW - 96, y + rowH * (i + 1), right, y + rowH * (i + 1));
  });

  y += rowH * totalRows.length + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(p.currencyNote || "", M, y);

  // ---- Signature block ---------------------------------------------------
  y += 46;
  doc.setFont("helvetica", "normal");
  doc.text("Full Name", M + 70, y);
  doc.line(M + 130, y + 3, M + 320, y + 3);
  doc.text("Signature", M + 380, y);
  doc.line(M + 440, y + 3, right, y + 3);

  y += 20;
  doc.setFontSize(8.5);
  const note = doc.splitTextToSize(p.footerNote || "", W - M * 2);
  doc.text(note, W / 2, y, { align: "center" });

  y += note.length * 11 + 26;
  doc.setFontSize(9);
  doc.text("PO", M + 20, y);
  doc.line(M + 90, y + 3, M + 370, y + 3);

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.text("1 of 1", right, pageH - 28, { align: "right" });

  return doc;
}

export function downloadProposalPdf(p: Proposal) {
  const doc = buildProposalDoc(p);
  doc.save(`sales-proposal-${p.proposalNumber || "draft"}.pdf`);
}

export function proposalPreviewUrl(p: Proposal) {
  return buildProposalDoc(p).output("bloburl").toString();
}
