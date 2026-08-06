export type SubLine = {
  id: string;
  line: string;
  item: string;
  mfgr: string;
  description: string;
  qty: number;
  listPrice: number;
  discPct: number;
  unitPrice: number;
};

export type LineItem = {
  id: string;
  line: string;
  item: string;
  mfgr: string;
  description: string;
  qty: number;
  listPrice: number;
  discPct: number;
  unitPrice: number;
  subLines: SubLine[];
};


export type Party = {
  name: string;
  address: string; // multiline
  attn: string;
  email: string;
};

export type CustomField = { id: string; label: string; value: string };

export type Proposal = {
  logo: string; // data URL
  vendorName: string;
  proposalNumber: string;
  date: string;
  terms: string;
  validFor: string;
  so: string;
  customer: Party;
  shipTo: Party;
  proposalBy: Party;
  items: LineItem[];
  freight: number;
  currencyNote: string;
  footerNote: string;
  customFields: CustomField[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyParty = (): Party => ({ name: "", address: "", attn: "", email: "" });

export const emptyItem = (index: number): LineItem => ({
  id: uid(),
  line: String(index + 1).padStart(4, "0"),
  item: "",
  mfgr: "",
  description: "",
  qty: 1,
  listPrice: 0,
  discPct: 0,
  unitPrice: 0,
  subLines: [],
});

export const emptySubLine = (parentLine: string, index: number): SubLine => ({
  id: uid(),
  line: `${parentLine || "0001"}.${index + 1}`,
  item: "",
  mfgr: "",
  description: "",
  qty: 1,
  listPrice: 0,
  discPct: 0,
  unitPrice: 0,
});


export function emptyProposal(): Proposal {
  return {
    logo: "",
    vendorName: "",
    proposalNumber: "",
    date: new Date().toLocaleDateString("en-US"),
    terms: "",
    validFor: "",
    so: "0",
    customer: emptyParty(),
    shipTo: emptyParty(),
    proposalBy: emptyParty(),
    items: [emptyItem(0)],
    freight: 0,
    currencyNote: "All Currency Totals are in US Dollar",
    footerNote:
      "You may use this form as a purchase order. Initial the items you want to purchase, enter Purchase Order (if any), sign, then mail, email or fax back to us",
    customFields: [],
  };
}

export const extended = (i: LineItem) => i.qty * i.unitPrice;

export function totals(p: Proposal) {
  const totalSale = p.items.reduce((s, i) => s + extended(i), 0);
  return { totalSale, freight: p.freight || 0, yourPrice: totalSale + (p.freight || 0) };
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
