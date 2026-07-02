"use client";

import { useState, useId, useEffect } from "react";
import type { ShowcaseModel } from "@/types/product";

function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-green-500">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

interface Props {
  model: ShowcaseModel;
  initialColorIndex: number;
  open: boolean;
  onClose: () => void;
  productSlug?: string;
  productImageUrl?: string;
}

type State = "idle" | "submitting" | "success" | "error";
type VariantCount = Record<string, number>; // key = ean

export function QuoteRequestDialog({ model, initialColorIndex, open, onClose, productSlug, productImageUrl }: Props) {
  const formId = useId();

  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [bedrukking, setBedrukking] = useState(false);
  const [opmerkingen, setOpmerkingen] = useState("");

  const [counts, setCounts] = useState<VariantCount>({});

  const initialColorName = model.colorGroups[initialColorIndex]?.colorName ?? model.colorGroups[0]?.colorName ?? "";
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialColorName ? [initialColorName] : [])
  );

  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const totaal = Object.values(counts).reduce((s, n) => s + n, 0);
  const canSubmit = naam.trim() !== "" && email.trim() !== "" && totaal > 0 && state === "idle";

  function setCount(ean: string, delta: number) {
    setCounts((prev) => {
      const next = (prev[ean] ?? 0) + delta;
      if (next <= 0) {
        const { [ean]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [ean]: next };
    });
  }

  function toggleColor(colorName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(colorName)) next.delete(colorName);
      else next.add(colorName);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState("submitting");

    const varianten = model.colorGroups.flatMap((cg) =>
      cg.variants
        .filter((v) => (counts[v.ean] ?? 0) > 0)
        .map((v) => ({
          kleur: cg.colorName,
          maat: v.sizeDisplay,
          ean: v.ean,
          aantal: counts[v.ean]!,
        }))
    );

    const payload = {
      idempotency_key: crypto.randomUUID(),
      naam: naam.trim(),
      email: email.trim(),
      telefoon: telefoon.trim() || null,
      bedrijfsnaam: bedrijfsnaam.trim() || null,
      product_naam: model.modelName,
      product_slug: productSlug ?? null,
      product_image_url: productImageUrl ?? null,
      varianten,
      bedrukking,
      opmerkingen: opmerkingen.trim() || null,
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/distribution/showcase/quote-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("success");
    } catch (err) {
      console.error("Quote request failed:", err);
      setErrorMsg(
        "Verzenden mislukt. Probeer het opnieuw of neem direct contact op via kleding@vankruiningen.nl"
      );
      setState("error");
    }
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]); // handleClose is stable binnen de render-scope

  function handleClose() {
    if (state === "submitting") return;
    setState("idle");
    setNaam("");
    setEmail("");
    setTelefoon("");
    setBedrijfsnaam("");
    setBedrukking(false);
    setOpmerkingen("");
    setCounts({});
    setErrorMsg("");
    setExpanded(new Set(initialColorName ? [initialColorName] : []));
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 id={`${formId}-title`} className="text-xl font-semibold text-gray-900">
              Offerte aanvragen
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{model.modelName}</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Sluiten"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Content */}
        {state === "success" ? (
          <div className="flex flex-col items-center text-center p-8 gap-4">
            <IconCheckCircle />
            <h3 className="text-lg font-semibold text-gray-900">Bedankt, {naam}!</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Uw offerte aanvraag voor <strong>{model.modelName}</strong> ({totaal} stuks) is
              ontvangen. U ontvangt ook een bevestiging per e-mail. We nemen zo spoedig mogelijk
              contact met u op.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 px-6 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sluiten
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
            {/* Productselectie */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Productselectie</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {model.colorGroups.map((cg) => {
                  const isOpen = expanded.has(cg.colorName);
                  const colorTotal = cg.variants.reduce(
                    (s, v) => s + (counts[v.ean] ?? 0),
                    0
                  );
                  return (
                    <div key={cg.colorName}>
                      <button
                        type="button"
                        onClick={() => toggleColor(cg.colorName)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">{isOpen ? "▼" : "▶"}</span>
                          {cg.colorName}
                        </span>
                        {colorTotal > 0 && (
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {colorTotal} st.
                          </span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 pt-1 space-y-1 bg-gray-50">
                          {cg.variants.map((v) => {
                            const count = counts[v.ean] ?? 0;
                            return (
                              <div
                                key={v.ean}
                                className="flex items-center justify-between py-1.5"
                              >
                                <span className="text-sm text-gray-700 min-w-[6rem]">
                                  {v.sizeDisplay}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCount(v.ean, -1)}
                                    disabled={count === 0}
                                    aria-label={`Minder van ${v.sizeDisplay}`}
                                    className="w-7 h-7 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold leading-none"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={count === 0 ? "" : count}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      const next = isNaN(val) || val < 0 ? 0 : val;
                                      setCounts((prev) => {
                                        if (next === 0) {
                                          const { [v.ean]: _, ...rest } = prev;
                                          return rest;
                                        }
                                        return { ...prev, [v.ean]: next };
                                      });
                                    }}
                                    aria-label={`Aantal van ${v.sizeDisplay}`}
                                    className="w-14 text-center text-sm font-semibold tabular-nums border border-gray-300 rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setCount(v.ean, 1)}
                                    aria-label={`Meer van ${v.sizeDisplay}`}
                                    className="w-7 h-7 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold leading-none"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">
                Totaal: <span className="text-gray-900">{totaal} stuks</span>
              </p>
            </div>

            {/* Contactgegevens */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  htmlFor={`${formId}-naam`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Naam <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${formId}-naam`}
                  type="text"
                  required
                  placeholder="Je volledige naam"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor={`${formId}-email`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  E-mailadres <span className="text-red-500">*</span>
                </label>
                <input
                  id={`${formId}-email`}
                  type="email"
                  required
                  placeholder="je@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`${formId}-tel`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Telefoonnummer
                  </label>
                  <input
                    id={`${formId}-tel`}
                    type="tel"
                    placeholder="06 12345678"
                    value={telefoon}
                    onChange={(e) => setTelefoon(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${formId}-bedrijf`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Bedrijfsnaam
                  </label>
                  <input
                    id={`${formId}-bedrijf`}
                    type="text"
                    placeholder="Optioneel"
                    value={bedrijfsnaam}
                    onChange={(e) => setBedrijfsnaam(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Bedrukking + opmerkingen */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bedrukking}
                  onChange={(e) => setBedrukking(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Ik wil bedrukking/borduring</span>
              </label>
              <div>
                <label
                  htmlFor={`${formId}-opmerking`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Opmerkingen
                </label>
                <textarea
                  id={`${formId}-opmerking`}
                  rows={3}
                  placeholder="Eventuele extra opmerkingen of vragen"
                  value={opmerkingen}
                  onChange={(e) => setOpmerkingen(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Foutmelding */}
            {state === "error" && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold
                         hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors flex items-center justify-center gap-2"
            >
              {state === "submitting" ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Aanvraag versturen...
                </>
              ) : (
                "Offerte aanvragen"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
