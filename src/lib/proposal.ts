export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CustomField = {
  id: string;
  label: string;
  value: string;
};

export type Proposal = {
  title: string;
  companyName: string;
  companyDetails: string;
  clientName: string;
  clientDetails: string;
  proposalNumber: string;
  date: string;
  validUntil: string;
  currency: string;
  taxRate: number;
  discount: number;
  notes: string;
  terms: string;
  customFields: CustomField[];
  items: LineItem[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyProposal(): Proposal {
  return {
    title: "Sales Proposal",
    companyName: "",
    companyDetails: "",
    clientName: "",
    clientDetails: "",
    proposalNumber: "",
    date: new Date().toISOString().slice(0, 10),
    validUntil: "",
    currency: "$",
    taxRate: 0,
    discount: 0,
    notes: "",
    terms: "",
    customFields: [],
    items: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }],
  };
}

export function totals(p: Proposal) {
  const subtotal = p.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = Math.min(p.discount || 0, subtotal);
  const taxed = subtotal - discount;
  const tax = taxed * ((p.taxRate || 0) / 100);
  return { subtotal, discount, tax, total: taxed + tax };
}

export function money(n: number, currency: string) {
  return `${currency}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
