import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { CornerDownRight, Download, FileUp, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { parseProposalPdf } from "@/lib/parse-proposal";
import { downloadProposalPdf, proposalPreviewUrl } from "@/lib/generate-pdf";
import { DEFAULT_LOGO } from "@/lib/default-logo";
import {
  emptyItem,
  emptyProposal,
  emptySubLine,
  extended,
  lineTotal,

  money,
  totals,
  uid,
  type LineItem,
  type Party,
  type Proposal,
  type SubLine,
} from "@/lib/proposal";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Proposal Editor — Edit & Re-export Sales Proposal PDFs" },
      {
        name: "description",
        content:
          "Upload a sales proposal PDF, edit every field, add line items, and download it back in the same format. Everything runs in your browser.",
      },
      { property: "og:title", content: "Proposal Editor — Edit & Re-export Sales Proposal PDFs" },
      {
        property: "og:description",
        content: "Upload, edit and re-export sales proposal PDFs without leaving your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProposalEditor,
});

function Field({
  label,
  value,
  onChange,
  className,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 bg-card"
      />
    </div>
  );
}

function PartyCard({
  title,
  party,
  onChange,
}: {
  title: string;
  party: Party;
  onChange: (p: Party) => void;
}) {
  return (
    <Card className="gap-0 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <Separator className="my-3" />
      <div className="space-y-3">
        <Field label="Name" value={party.name} onChange={(v) => onChange({ ...party, name: v })} />
        <div>
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Address
          </Label>
          <Textarea
            rows={4}
            value={party.address}
            onChange={(e) => onChange({ ...party, address: e.target.value })}
            className="mt-1.5 bg-card"
            placeholder={"Street\nSuite\nCity, State ZIP\nCOUNTRY"}
          />
        </div>
        <Field label="Attn" value={party.attn} onChange={(v) => onChange({ ...party, attn: v })} />
        <Field
          label="Email"
          value={party.email}
          onChange={(v) => onChange({ ...party, email: v })}
        />
      </div>
    </Card>
  );
}

function ProposalEditor() {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const set = useCallback(
    <K extends keyof Proposal>(key: K, value: Proposal[K]) =>
      setProposal((p) => (p ? { ...p, [key]: value } : p)),
    [],
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file.");
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseProposalPdf(file);
      setProposal({ ...parsed, logo: parsed.logo || DEFAULT_LOGO });
      toast.success(`Parsed ${parsed.items.length} line item(s) — check every field before export.`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't read that PDF. Starting from a blank proposal instead.");
      setProposal({ ...emptyProposal(), logo: DEFAULT_LOGO });
    } finally {
      setLoading(false);
    }
  };

  const t = useMemo(() => (proposal ? totals(proposal) : null), [proposal]);

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setProposal((p) =>
      p ? { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : p,
    );

  const addSubLine = (item: LineItem) =>
    updateItem(item.id, {
      subLines: [...(item.subLines ?? []), emptySubLine(item.line, (item.subLines ?? []).length)],
    });

  const updateSubLine = (item: LineItem, subId: string, patch: Partial<SubLine>) =>
    updateItem(item.id, {
      subLines: (item.subLines ?? []).map((s) => (s.id === subId ? { ...s, ...patch } : s)),
    });

  const removeSubLine = (item: LineItem, subId: string) =>
    updateItem(item.id, { subLines: (item.subLines ?? []).filter((s) => s.id !== subId) });


  const refreshPreview = () => {
    if (!proposal) return;
    window.open(proposalPreviewUrl(proposal), "_blank", "noopener,noreferrer");
  };

  if (!proposal) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Runs entirely in your browser
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Sales Proposal Editor
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Upload a proposal PDF, edit every field, add or remove line items, then export it back
            in the same layout.
          </p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFile(e.dataTransfer.files[0]);
            }}
            className="mt-10 w-full rounded-xl border-2 border-dashed border-border bg-card p-12 transition-colors hover:border-primary/50"
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="size-7 animate-spin" />
                <p className="text-sm">Reading your proposal…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <FileUp className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop a proposal PDF here</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => fileRef.current?.click()}>Choose PDF</Button>
                  <Button
                    variant="outline"
                    onClick={() => setProposal({ ...emptyProposal(), logo: DEFAULT_LOGO })}
                  >
                    Start blank
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              Sales Proposal {proposal.proposalNumber}
            </h1>
            <p className="text-xs text-muted-foreground">
              {proposal.items.length} line items · Your Price ${money(t!.yourPrice)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setProposal(null)}>
              <RotateCcw /> New
            </Button>
            <Button variant="outline" size="sm" onClick={refreshPreview}>
              Preview
            </Button>
            <Button size="sm" onClick={() => downloadProposalPdf(proposal)}>
              <Download /> Download PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Card className="gap-0 p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Proposal number"
              value={proposal.proposalNumber}
              onChange={(v) => set("proposalNumber", v)}
            />
            <Field
              label="Vendor name (header)"
              value={proposal.vendorName}
              onChange={(v) => set("vendorName", v)}
            />
            <Field label="Date" value={proposal.date} onChange={(v) => set("date", v)} />
            <Field label="Terms" value={proposal.terms} onChange={(v) => set("terms", v)} />
            <Field label="Valid for" value={proposal.validFor} onChange={(v) => set("validFor", v)} />
            <Field label="SO" value={proposal.so} onChange={(v) => set("so", v)} />
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-3">
            {proposal.logo ? (
              <img
                src={proposal.logo}
                alt="Proposal logo preview"
                className="h-10 w-auto rounded border border-border bg-card p-1"
              />
            ) : (
              <span className="text-sm text-muted-foreground">No logo</span>
            )}
            <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
              Replace logo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => set("logo", "")}>
              Remove
            </Button>
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => set("logo", String(reader.result));
                reader.readAsDataURL(f);
              }}
            />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <PartyCard
            title="Customer"
            party={proposal.customer}
            onChange={(v) => set("customer", v)}
          />
          <PartyCard title="Ship To" party={proposal.shipTo} onChange={(v) => set("shipTo", v)} />
          <PartyCard
            title="Proposal By"
            party={proposal.proposalBy}
            onChange={(v) => set("proposalBy", v)}
          />
        </div>

        <Card className="gap-0 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line items</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => set("items", [...proposal.items, emptyItem(proposal.items.length)])}
            >
              <Plus /> Add line item
            </Button>
          </div>
          <Separator className="my-3" />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="w-16 pb-2">Line</th>
                  <th className="w-40 pb-2">Item</th>
                  <th className="w-28 pb-2">Mfgr</th>
                  <th className="pb-2">Description</th>
                  <th className="w-16 pb-2 text-right">Qty</th>
                  <th className="w-24 pb-2 text-right">List</th>
                  <th className="w-20 pb-2 text-right">Disc %</th>
                  <th className="w-28 pb-2 text-right">Unit price</th>
                  <th className="w-28 pb-2 text-right">Extended</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody>
                {proposal.items.map((item) => (
                  <Fragment key={item.id}>
                    <tr className="border-t border-border align-top">
                      <td className="py-2 pr-2">
                        <Input
                          value={item.line}
                          onChange={(e) => updateItem(item.id, { line: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={item.item}
                          onChange={(e) => updateItem(item.id, { item: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={item.mfgr}
                          onChange={(e) => updateItem(item.id, { mfgr: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Textarea
                          rows={2}
                          value={item.description}
                          onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          className="text-right"
                          value={item.qty}
                          onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right"
                          value={item.listPrice}
                          onChange={(e) =>
                            updateItem(item.id, { listPrice: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right"
                          value={item.discPct}
                          onChange={(e) =>
                            updateItem(item.id, { discPct: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.id, { unitPrice: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-medium tabular-nums">
                        {money(extended(item))}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove line item"
                          onClick={() =>
                            set(
                              "items",
                              proposal.items.filter((i) => i.id !== item.id),
                            )
                          }
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </td>
                    </tr>

                    {(item.subLines ?? []).map((sub) => (
                      <tr key={sub.id} className="align-top bg-muted/40">
                        <td className="py-1.5 pr-2 pl-5" />
                        <td className="py-1.5 pr-2">
                          <Input
                            value={sub.item}
                            onChange={(e) => updateSubLine(item, sub.id, { item: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            value={sub.mfgr}
                            onChange={(e) => updateSubLine(item, sub.id, { mfgr: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Textarea
                            rows={2}
                            value={sub.description}
                            onChange={(e) =>
                              updateSubLine(item, sub.id, { description: e.target.value })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            className="text-right"
                            value={sub.qty}
                            onChange={(e) =>
                              updateSubLine(item, sub.id, { qty: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right"
                            value={sub.listPrice}
                            onChange={(e) =>
                              updateSubLine(item, sub.id, { listPrice: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right"
                            value={sub.discPct}
                            onChange={(e) =>
                              updateSubLine(item, sub.id, { discPct: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="text-right"
                            value={sub.unitPrice}
                            onChange={(e) =>
                              updateSubLine(item, sub.id, { unitPrice: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {money(extended(sub))}
                        </td>
                        <td className="py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove sub line"
                            onClick={() => removeSubLine(item, sub.id)}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-muted/20">
                      <td colSpan={8} className="pb-2 pl-5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => addSubLine(item)}
                        >
                          <CornerDownRight /> Add sub line to {item.line || "line"}
                        </Button>
                      </td>
                      <td className="pb-2 pr-2 text-right text-xs font-semibold tabular-nums">
                        {(item.subLines ?? []).length > 0 ? money(lineTotal(item)) : ""}
                      </td>
                      <td />
                    </tr>
                  </Fragment>
                ))}

              </tbody>
            </table>
          </div>

          <Separator className="my-4" />
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Sale</span>
              <span className="font-medium tabular-nums">{money(t!.totalSale)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Freight</span>
              <Input
                type="number"
                step="0.01"
                className="w-32 text-right"
                value={proposal.freight}
                onChange={(e) => set("freight", Number(e.target.value) || 0)}
              />
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Your Price</span>
              <span className="tabular-nums">$ {money(t!.yourPrice)}</span>
            </div>
          </div>
        </Card>

        <Card className="gap-0 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Custom fields</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                set("customFields", [
                  ...proposal.customFields,
                  { id: uid(), label: "New field", value: "" },
                ])
              }
            >
              <Plus /> Add field
            </Button>
          </div>
          {proposal.customFields.length > 0 && <Separator className="my-3" />}
          <div className="grid gap-3 sm:grid-cols-2">
            {proposal.customFields.map((f) => (
              <div key={f.id} className="flex items-end gap-2">
                <Field
                  className="flex-1"
                  label="Label"
                  value={f.label}
                  onChange={(v) =>
                    set(
                      "customFields",
                      proposal.customFields.map((c) => (c.id === f.id ? { ...c, label: v } : c)),
                    )
                  }
                />
                <Field
                  className="flex-1"
                  label="Value"
                  value={f.value}
                  onChange={(v) =>
                    set(
                      "customFields",
                      proposal.customFields.map((c) => (c.id === f.id ? { ...c, value: v } : c)),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove custom field"
                  onClick={() =>
                    set(
                      "customFields",
                      proposal.customFields.filter((c) => c.id !== f.id),
                    )
                  }
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="gap-0 p-4">
          <h3 className="text-sm font-semibold">Footer</h3>
          <Separator className="my-3" />
          <div className="space-y-3">
            <Field
              label="Currency note"
              value={proposal.currencyNote}
              onChange={(v) => set("currencyNote", v)}
            />
            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Purchase order note
              </Label>
              <Textarea
                rows={2}
                className="mt-1.5 bg-card"
                value={proposal.footerNote}
                onChange={(e) => set("footerNote", e.target.value)}
              />
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
