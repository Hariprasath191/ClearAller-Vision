import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Menu,
  PackageSearch,
  Pencil,
  Plus,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users2,
  X
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import type { AllergyCategory, SafetyPrediction } from "@clearaller/shared";
import { api } from "./lib/api";
import {
  allergyOptions,
  cosmeticConcernOptions,
  genderOptions,
  hairTypeOptions,
  productLensOptions,
  severityOptions,
  skinTypeOptions
} from "./lib/constants";
import { AnalysisResults } from "./components/AnalysisResults";
import { ImageCapturePanel } from "./components/ImageCapturePanel";
import { ProductSearchPanel } from "./components/ProductSearchPanel";
import { SafetyChatWidget } from "./components/SafetyChatWidget";

/* ── Types ──────────────────────────────────────────────── */
type Account = { id: string; email: string; displayName: string };

type AllergySettingForm = {
  category: AllergyCategory;
  severity: (typeof severityOptions)[number];
};

type Profile = {
  id: string;
  name: string;
  age: number;
  medicalConditions?: Array<{ name: string; note?: string }>;
  allergySettings: Array<{ category: string; severity: string }>;
};

type Dashboard = {
  profiles: Profile[];
  recentAnalyses: Array<{ id: string; createdAt: string; productQuery?: string | null; normalizedText: string }>;
  knowledgeCount: number;
};

type ProductLens = (typeof productLensOptions)[number];
type GenderOption = (typeof genderOptions)[number];
type SkinType = (typeof skinTypeOptions)[number];
type HairType = (typeof hairTypeOptions)[number];
type CosmeticConcern = (typeof cosmeticConcernOptions)[number];

/* ── Helpers ────────────────────────────────────────────── */
const blankAllergy = (): AllergySettingForm => ({ category: "dairy", severity: "medium" });

const initialProfile = () => ({
  name: "", age: 18,
  allergySettings: [blankAllergy()],
  medicalCondition: "",
  gender: "female" as GenderOption,
  skinType: "normal" as SkinType,
  hairType: "straight" as HairType,
  cosmeticConcerns: [] as CosmeticConcern[]
});

function readNote(c: Profile["medicalConditions"], note: string) {
  return c?.find((e) => e.note === note)?.name ?? "";
}
function readNotes(c: Profile["medicalConditions"], note: string) {
  return c?.filter((e) => e.note === note).map((e) => e.name) ?? [];
}
function normalizeGender(v: string): GenderOption { return v === "male" ? "male" : "female"; }
function errMsg(e: unknown) {
  const a = e as AxiosError<{ message?: string }>;
  return a.response?.data?.message ?? a.message ?? "Something went wrong.";
}

/* ── App ────────────────────────────────────────────────── */
export default function App() {
  const qc = useQueryClient();
  const [lens, setLens] = useState<ProductLens>("packaged-food");
  const [selIds, setSelIds] = useState<string[]>([]);
  const [scope, setScope] = useState<"selected" | "all">("all");
  const [ingText, setIngText] = useState("");
  const [prodQ, setProdQ] = useState("");
  const [results, setResults] = useState<SafetyPrediction[]>([]);
  const [form, setForm] = useState(initialProfile());
  const [editId, setEditId] = useState<string | null>(null);
  const [pMsg, setPMsg] = useState<string | null>(null);
  const [pMsgType, setPMsgType] = useState<"success" | "error" | null>(null);
  const [aMsg, setAMsg] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [delProfile, setDelProfile] = useState<Profile | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  /* Queries */
  const acctQ = useQuery({ queryKey: ["account"], queryFn: async () => (await api.get<Account>("/api/account/demo")).data });
  const userId = acctQ.data?.id;
  const profsQ = useQuery({ queryKey: ["profiles", userId], enabled: Boolean(userId), queryFn: async () => (await api.get<Profile[]>("/api/profiles", { params: { userId } })).data });
  const dashQ = useQuery({ queryKey: ["dashboard", userId], enabled: Boolean(userId), queryFn: async () => (await api.get<Dashboard>("/api/dashboard", { params: { userId } })).data });

  useEffect(() => { if (profsQ.data?.length && selIds.length === 0) setSelIds([profsQ.data[0].id]); }, [profsQ.data, selIds.length]);

  /* Mutations */
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Account loading…");
      if (!form.name.trim()) throw new Error("Enter a profile name.");
      if (!Number.isInteger(form.age) || form.age <= 0) throw new Error("Enter a valid age.");
      const cleaned = form.allergySettings.map((e) => ({ category: e.category, severity: e.severity }));
      if (!cleaned.length) throw new Error("Add at least one allergy.");
      if (new Set(cleaned.map((e) => e.category)).size !== cleaned.length) throw new Error("Duplicate allergy categories.");
      const payload = {
        userId, name: form.name.trim(), age: form.age, allergySettings: cleaned,
        medicalConditions: [
          ...(form.medicalCondition.trim() ? [{ name: form.medicalCondition.trim() }] : []),
          ...(form.gender ? [{ name: form.gender, note: "gender" }] : []),
          ...(form.skinType ? [{ name: form.skinType, note: "skinType" }] : []),
          ...(form.hairType ? [{ name: form.hairType, note: "hairType" }] : []),
          ...form.cosmeticConcerns.map((c) => ({ name: c, note: "cosmeticConcern" as const }))
        ]
      };
      editId ? await api.put(`/api/profiles/${editId}`, payload) : await api.post("/api/profiles", payload);
    },
    onSuccess: async () => {
      const was = Boolean(editId);
      setForm(initialProfile()); setEditId(null);
      setPMsgType("success"); setPMsg(was ? "Profile updated." : "Profile saved.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["profiles", userId] }), qc.invalidateQueries({ queryKey: ["dashboard", userId] })]);
    },
    onError: (e) => { setPMsgType("error"); setPMsg(errMsg(e)); }
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => { if (!userId) throw new Error("Account loading…"); await api.delete(`/api/profiles/${id}`, { params: { userId } }); return id; },
    onSuccess: async (id) => {
      setSelIds((c) => c.filter((x) => x !== id));
      if (editId === id) { setEditId(null); setForm(initialProfile()); }
      setPMsgType("success"); setPMsg("Profile deleted.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["profiles", userId] }), qc.invalidateQueries({ queryKey: ["dashboard", userId] })]);
    },
    onError: (e) => { setPMsgType("error"); setPMsg(errMsg(e)); }
  });

  const analyzeMut = useMutation({
    mutationFn: async () => {
      if (!userId) return [] as SafetyPrediction[];
      const res = await api.post<{ predictions: SafetyPrediction[] }>("/api/analyze", { userId, extractedText: ingText, productQuery: prodQ, scope, profileIds: scope === "selected" ? selIds : undefined });
      return res.data.predictions;
    },
    onSuccess: async (p) => { setResults(p); setChooserOpen(false); setAMsg(null); await qc.invalidateQueries({ queryKey: ["dashboard", userId] }); },
    onError: (e) => setAMsg(errMsg(e))
  });

  const metrics = useMemo(() => ({ profiles: dashQ.data?.profiles.length ?? 0, analyses: dashQ.data?.recentAnalyses.length ?? 0 }), [dashQ.data]);
  const canSave = form.name.trim().length >= 2 && Number.isInteger(form.age) && form.age > 0 && form.allergySettings.length > 0 && !saveMut.isPending;
  const canAnalyze = ingText.trim().length > 0 && profsQ.data && profsQ.data.length > 0;

  function resetForm() { setForm(initialProfile()); setEditId(null); setPMsg(null); setPMsgType(null); }
  function startEdit(p: Profile) {
    setEditId(p.id);
    setForm({
      name: p.name, age: p.age,
      allergySettings: p.allergySettings.map((s) => ({ category: s.category as AllergyCategory, severity: s.severity as (typeof severityOptions)[number] })),
      medicalCondition: p.medicalConditions?.find((e) => !e.note)?.name ?? "",
      gender: normalizeGender(readNote(p.medicalConditions, "gender")),
      skinType: (readNote(p.medicalConditions, "skinType") || "normal") as SkinType,
      hairType: (readNote(p.medicalConditions, "hairType") || "straight") as HairType,
      cosmeticConcerns: readNotes(p.medicalConditions, "cosmeticConcern") as CosmeticConcern[]
    });
    setPMsgType(null); setPMsg(`Editing ${p.name}`);
  }
  function openChooser() {
    if (!ingText.trim()) { setAMsg("Scan or paste ingredient text first."); return; }
    if (!profsQ.data?.length) { setAMsg("Save at least one profile first."); return; }
    setAMsg(null); setChooserOpen(true);
  }
  function runAnalysis() {
    if (scope === "selected" && selIds.length === 0) { setAMsg("Select at least one profile."); return; }
    analyzeMut.mutate();
  }
  function updateAllergy(i: number, k: keyof AllergySettingForm, v: string) { setForm((c) => ({ ...c, allergySettings: c.allergySettings.map((e, j) => j === i ? { ...e, [k]: v } : e) })); setPMsg(null); setPMsgType(null); }
  function addAllergy() { setForm((c) => ({ ...c, allergySettings: [...c.allergySettings, blankAllergy()] })); setPMsg(null); }
  function removeAllergy(i: number) { setForm((c) => ({ ...c, allergySettings: c.allergySettings.filter((_, j) => j !== i) })); setPMsg(null); }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", color: "var(--c-text)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "1rem 1.25rem 5rem" }}>

        {/* ═══════ Nav ═══════ */}
        <nav className="nav">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--c-blue)", display: "grid", placeItems: "center", color: "#fff" }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>ClearAller Vision</p>
              <p style={{ fontSize: "0.72rem", color: "var(--c-text-dim)" }}>Allergen transparency platform</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden md:flex">
            {[["Overview", "#overview"], ["Profiles", "#profiles"], ["Analyze", "#analysis"], ["Search", "#search"]].map(([l, h]) => (
              <a key={h} href={h} className="nav-link">{l}</a>
            ))}
          </div>
          <button onClick={() => setMobileNav((c) => !c)} className="md:hidden" style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid var(--c-border)", background: "var(--c-raised)", display: "grid", placeItems: "center", color: "var(--c-text-sub)" }} aria-label="Menu">
            {mobileNav ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
        {mobileNav && (
          <div style={{ marginTop: 8, padding: 8, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16 }} className="md:hidden">
            {[["Overview", "#overview"], ["Profiles", "#profiles"], ["Analyze", "#analysis"], ["Search", "#search"]].map(([l, h]) => (
              <a key={h} href={h} onClick={() => setMobileNav(false)} style={{ display: "block", padding: "0.6rem 1rem", fontSize: "0.875rem", color: "var(--c-text-sub)", borderRadius: 8 }}>{l}</a>
            ))}
          </div>
        )}

        <main style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ═══════ Section: Overview ═══════ */}
          <section id="overview" className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">

            {/* Hero */}
            <div className="card" style={{ padding: "2rem 2rem 2.25rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span className="chip chip-blue">OCR + label parsing</span>
                <span className="chip chip-green">Profile-specific safety</span>
                <span className="chip chip-purple">Top safe picks</span>
              </div>
              <p className="eyebrow" style={{ marginTop: 24 }}>Allergen clarity for real packaging</p>
              <h1 style={{ marginTop: 12, fontSize: "clamp(1.75rem, 4vw, 3rem)", fontWeight: 700, lineHeight: 1.1, maxWidth: 600 }}>
                {lens === "cosmetic" ? "Match cosmetics to your allergy & skin needs." : "Check packaged foods for hidden allergens."}
              </h1>
              <p style={{ marginTop: 16, color: "var(--c-text-sub)", lineHeight: 1.7, maxWidth: 560, fontSize: "0.95rem" }}>
                {lens === "cosmetic"
                  ? "Cosmetic mode delivers skin-type and hair-type aware recommendations with ingredient safety checks."
                  : "Food mode scans labels, compares family profiles, and surfaces safer products."}
              </p>

              {/* Mode switcher */}
              <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: 28, maxWidth: 560 }}>
                <button onClick={() => setLens("packaged-food")} className={`lens-card ${lens === "packaged-food" ? "active-food" : ""}`}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: lens === "packaged-food" ? "var(--c-blue-bg)" : "rgba(255,255,255,0.06)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--c-blue)" }}>
                      <PackageSearch size={17} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "1rem" }}>Packaged food</p>
                      <p style={{ fontSize: "0.8rem", color: "var(--c-text-sub)", marginTop: 4, lineHeight: 1.5 }}>Pantry items, snacks, cereals</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => setLens("cosmetic")} className={`lens-card ${lens === "cosmetic" ? "active-cosmetic" : ""}`}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: lens === "cosmetic" ? "var(--c-purple-bg)" : "rgba(255,255,255,0.06)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--c-purple)" }}>
                      <Sparkles size={17} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "1rem" }}>Cosmetic</p>
                      <p style={{ fontSize: "0.8rem", color: "var(--c-text-sub)", marginTop: 4, lineHeight: 1.5 }}>Skin care, hair care, personal care</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Sidebar: Stats + Scope */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Metrics */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <p className="eyebrow">Dashboard</p>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: 8 }}>Account at a glance</h2>
                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  <Metric icon={<Users2 size={17} />} label="Profiles" value={metrics.profiles} color="var(--c-blue)" bg="var(--c-blue-bg)" />
                  <Metric icon={<ScanSearch size={17} />} label="Analyses" value={metrics.analyses} color="var(--c-green)" bg="var(--c-green-bg)" />
                  <Metric icon={<Sparkles size={17} />} label="Mode" value={lens === "cosmetic" ? "Beauty" : "Food"} color="var(--c-purple)" bg="var(--c-purple-bg)" />
                </div>
              </div>

              {/* Scope chooser */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <p className="eyebrow">Analysis mode</p>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: 8 }}>Choose check scope</h2>
                  </div>
                  <CheckCircle2 size={18} style={{ color: "var(--c-green)", flexShrink: 0 }} />
                </div>
                <div className="toggle-group" style={{ marginTop: 16 }}>
                  <button className={`toggle-btn ${scope === "selected" ? "active" : ""}`} onClick={() => setScope("selected")}>Selected</button>
                  <button className={`toggle-btn ${scope === "all" ? "active" : ""}`} onClick={() => setScope("all")}>All profiles</button>
                </div>
                {/* Profile pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {profsQ.data?.length ? profsQ.data.map((p) => {
                    const on = selIds.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => setSelIds((c) => on ? c.filter((x) => x !== p.id) : [...c, p.id])}
                        style={{ padding: "0.3rem 0.75rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 500, border: "1px solid " + (on ? "var(--c-blue-border)" : "var(--c-border)"), background: on ? "var(--c-blue-bg)" : "transparent", color: on ? "var(--c-blue)" : "var(--c-text-sub)", cursor: "pointer", transition: "all 150ms" }}>
                        {p.name}
                      </button>
                    );
                  }) : <span style={{ fontSize: "0.78rem", color: "var(--c-text-dim)" }}>Add a profile to start</span>}
                </div>
              </div>
            </div>
          </section>

          {/* ═══════ Section: Profiles ═══════ */}
          <section id="profiles" className="grid gap-6 xl:grid-cols-2">
            {/* Form */}
            <div className="card" style={{ padding: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p className="eyebrow">Profile manager</p>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: 8 }}>Create and tune allergy profiles</h2>
                </div>
                {editId && <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldLabel label="Profile name">
                    <input className="field-input" value={form.name} placeholder="e.g. Hari, Patient 01" onChange={(e) => { setForm((c) => ({ ...c, name: e.target.value })); setPMsg(null); }} />
                  </FieldLabel>
                  <FieldLabel label="Age">
                    <input className="field-input" type="number" value={form.age} onChange={(e) => { setForm((c) => ({ ...c, age: Number(e.target.value) })); setPMsg(null); }} />
                  </FieldLabel>
                </div>

                {/* Allergy matrix */}
                <div className="card-raised" style={{ padding: "1rem 1.125rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>Allergy matrix</p>
                      <p style={{ fontSize: "0.78rem", color: "var(--c-text-sub)", marginTop: 2 }}>Assign category and severity</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={addAllergy}><Plus size={14} /> Add</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {form.allergySettings.map((entry, i) => (
                      <div key={`a-${i}`} className="allergy-row">
                        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                          <FieldLabel label="Type">
                            <select className="field-input" value={entry.category} onChange={(e) => updateAllergy(i, "category", e.target.value)}>
                              {allergyOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </FieldLabel>
                          <FieldLabel label="Severity">
                            <select className="field-input" value={entry.severity} onChange={(e) => updateAllergy(i, "severity", e.target.value)}>
                              {severityOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </FieldLabel>
                          <div style={{ display: "flex", alignItems: "flex-end" }}>
                            <button className="btn btn-danger btn-sm" onClick={() => removeAllergy(i)} disabled={form.allergySettings.length === 1}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <FieldLabel label="Medical condition (optional)">
                  <input className="field-input" value={form.medicalCondition} placeholder="Asthma, eczema, dermatitis…" onChange={(e) => { setForm((c) => ({ ...c, medicalCondition: e.target.value })); setPMsg(null); }} />
                </FieldLabel>

                <FieldLabel label="Gender">
                  <select className="field-input" value={form.gender} onChange={(e) => { setForm((c) => ({ ...c, gender: e.target.value as GenderOption })); setPMsg(null); }}>
                    {genderOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FieldLabel>

                {/* Cosmetic preferences */}
                <div className="card-raised" style={{ padding: "1rem 1.125rem" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>Cosmetic preferences</p>
                  <p style={{ fontSize: "0.78rem", color: "var(--c-text-sub)", marginTop: 2 }}>Helps cosmetic mode find better matches</p>
                  <div className="grid gap-3 md:grid-cols-3" style={{ marginTop: 12 }}>
                    <FieldLabel label="Skin type">
                      <select className="field-input" value={form.skinType} onChange={(e) => { setForm((c) => ({ ...c, skinType: e.target.value as SkinType })); setPMsg(null); }}>
                        {skinTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </FieldLabel>
                    <FieldLabel label="Hair type">
                      <select className="field-input" value={form.hairType} onChange={(e) => { setForm((c) => ({ ...c, hairType: e.target.value as HairType })); setPMsg(null); }}>
                        {hairTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </FieldLabel>
                    <FieldLabel label="Concerns">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                        {cosmeticConcernOptions.filter((o) => o !== "none").map((o) => {
                          const on = form.cosmeticConcerns.includes(o);
                          return (
                            <button key={o} type="button"
                              onClick={() => { setForm((c) => ({ ...c, cosmeticConcerns: c.cosmeticConcerns.includes(o) ? c.cosmeticConcerns.filter((x) => x !== o) : [...c.cosmeticConcerns, o] })); setPMsg(null); }}
                              style={{ padding: "0.25rem 0.6rem", borderRadius: 16, fontSize: "0.72rem", fontWeight: 500, border: "1px solid " + (on ? "var(--c-blue-border)" : "var(--c-border)"), background: on ? "var(--c-blue-bg)" : "transparent", color: on ? "var(--c-blue)" : "var(--c-text-sub)", cursor: "pointer" }}>
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    </FieldLabel>
                  </div>
                </div>

                {pMsg && (
                  <div style={{ padding: "0.6rem 0.875rem", borderRadius: 10, fontSize: "0.8rem", background: pMsgType === "success" ? "var(--c-green-bg)" : "var(--c-red-bg)", color: pMsgType === "success" ? "var(--c-green)" : "var(--c-red)", border: `1px solid ${pMsgType === "success" ? "var(--c-green-border)" : "var(--c-red-border)"}` }}>
                    {pMsg}
                  </div>
                )}

                <button className="btn btn-primary" onClick={() => saveMut.mutate()} disabled={!canSave} style={{ alignSelf: "flex-start" }}>
                  {saveMut.isPending ? (editId ? "Updating…" : "Saving…") : editId ? "Update profile" : "Save profile"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Saved profiles */}
            <div className="card" style={{ padding: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <p className="eyebrow">Saved profiles</p>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: 8 }}>Active allergy profiles</h2>
                </div>
                <span className="chip chip-blue">{profsQ.data?.length ?? 0} active</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
                {profsQ.data?.length ? profsQ.data.map((p) => {
                  const sel = selIds.includes(p.id);
                  return (
                    <article key={p.id} className={`profile-card ${sel ? "selected" : ""}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <span className="chip chip-dim" style={{ marginBottom: 6 }}>{sel ? "Selected" : "Saved"}</span>
                          <h3 style={{ fontSize: "1.3rem", fontWeight: 600 }}>{p.name}</h3>
                          <p style={{ fontSize: "0.8rem", color: "var(--c-text-sub)", marginTop: 2 }}>Age {p.age}</p>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}><Pencil size={13} /> Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDelProfile(p)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                        {p.allergySettings.map((s) => (
                          <span key={`${p.id}-${s.category}`} className="chip chip-dim">{s.category} · {s.severity}</span>
                        ))}
                      </div>
                      {p.medicalConditions?.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                          <span className="chip chip-red" style={{ textTransform: "capitalize" }}>
                            {normalizeGender(readNote(p.medicalConditions, "gender"))}
                          </span>
                          <span className="chip chip-blue">Skin: {readNote(p.medicalConditions, "skinType") || "normal"}</span>
                          <span className="chip chip-purple">Hair: {readNote(p.medicalConditions, "hairType") || "straight"}</span>
                          {readNotes(p.medicalConditions, "cosmeticConcern").map((c) => (
                            <span key={`${p.id}-cc-${c}`} className="chip chip-green">{c}</span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                }) : (
                  <div style={{ padding: "1.25rem", background: "var(--c-raised)", border: "1px solid var(--c-border)", borderRadius: 12, fontSize: "0.85rem", color: "var(--c-text-sub)" }}>
                    No profiles yet. Create your first allergy profile to unlock analysis.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ═══════ Section: Analysis ═══════ */}
          <section id="analysis" className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <ImageCapturePanel ingredientText={ingText} setIngredientText={setIngText} />
            <div className="card" style={{ padding: "1.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p className="eyebrow">Allergen analysis</p>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginTop: 8, maxWidth: 500 }}>Review ingredients, then run predictions.</h2>
                </div>
                <button className="btn btn-primary" onClick={openChooser} disabled={!canAnalyze}>
                  Analyze now <ArrowRight size={16} />
                </button>
              </div>
              {aMsg && <div style={{ marginTop: 12, padding: "0.6rem 0.875rem", borderRadius: 10, fontSize: "0.8rem", background: "var(--c-red-bg)", color: "var(--c-red)", border: "1px solid var(--c-red-border)" }}>{aMsg}</div>}
              <div className="card-raised" style={{ marginTop: 16, padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--c-text-sub)", fontWeight: 500 }}>Normalized ingredients</p>
                  <span className={`chip ${ingText.trim() ? "chip-green" : "chip-dim"}`}>{ingText.trim() ? "Ready" : "Waiting"}</span>
                </div>
                <textarea className="field-input" value={ingText} onChange={(e) => setIngText(e.target.value)} placeholder="OCR text appears here, or paste ingredients manually" style={{ marginTop: 10, minHeight: 180, resize: "vertical", borderRadius: 12 }} />
              </div>
              <AnalysisResults predictions={results} loading={analyzeMut.isPending} />
            </div>
          </section>

          {/* ═══════ Section: Search ═══════ */}
          <section id="search">
            <ProductSearchPanel userId={userId} profileIds={selIds} initialQuery={prodQ} lens={lens} />
          </section>
        </main>
      </div>

      {/* Chat widget */}
      <SafetyChatWidget userId={userId} profileIds={selIds} lens={lens} />

      {/* ═══════ Modal: Delete ═══════ */}
      {delProfile && (
        <Overlay>
          <div className="card" style={{ maxWidth: 420, width: "100%", padding: "1.5rem" }}>
            <p className="eyebrow">Delete profile</p>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginTop: 8 }}>Remove {delProfile.name}?</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--c-text-sub)", marginTop: 8, lineHeight: 1.6 }}>This removes the profile and its allergy settings.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setDelProfile(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { delMut.mutate(delProfile.id); setDelProfile(null); }}>Delete</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ═══════ Modal: Analysis chooser ═══════ */}
      {chooserOpen && (
        <Overlay>
          <div className="card" style={{ maxWidth: 560, width: "100%", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p className="eyebrow">Analysis target</p>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginTop: 8 }}>How should this be checked?</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setChooserOpen(false)}>Close</button>
            </div>
            <div className="toggle-group" style={{ marginTop: 16 }}>
              <button className={`toggle-btn ${scope === "selected" ? "active" : ""}`} onClick={() => setScope("selected")}>Selected</button>
              <button className={`toggle-btn ${scope === "all" ? "active" : ""}`} onClick={() => setScope("all")}>All profiles</button>
            </div>
            {scope === "selected" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {profsQ.data?.map((p) => {
                  const on = selIds.includes(p.id);
                  return (
                    <button key={`ch-${p.id}`} onClick={() => setSelIds((c) => on ? c.filter((x) => x !== p.id) : [...c, p.id])}
                      style={{ padding: "0.3rem 0.75rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 500, border: `1px solid ${on ? "var(--c-blue-border)" : "var(--c-border)"}`, background: on ? "var(--c-blue-bg)" : "transparent", color: on ? "var(--c-blue)" : "var(--c-text-sub)", cursor: "pointer" }}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
            {aMsg && <div style={{ marginTop: 12, padding: "0.6rem 0.875rem", borderRadius: 10, fontSize: "0.8rem", background: "var(--c-red-bg)", color: "var(--c-red)" }}>{aMsg}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setChooserOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzeMut.isPending || (scope === "selected" && selIds.length === 0)}>
                {analyzeMut.isPending ? "Analyzing…" : "Start analysis"}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/* ═══════ Small reusable components ═══════ */

function Metric({ icon, label, value, color, bg }: { icon: ReactNode; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ background: bg, color }}>{icon}</div>
      <div>
        <p style={{ fontSize: "0.75rem", color: "var(--c-text-sub)" }}>{label}</p>
        <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: 2 }}>{value}</p>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--c-text-sub)" }}>{label}</span>
      {children}
    </label>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      {children}
    </div>
  );
}
