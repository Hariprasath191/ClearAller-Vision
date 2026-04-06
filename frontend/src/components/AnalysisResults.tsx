import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type { SafetyPrediction, RiskHit, MlSignal } from "@clearaller/shared";

type ConfidenceBand = "Low Evidence" | "Moderate Evidence" | "Strong Evidence";

type SafetyPredictionView = SafetyPrediction & {
  confidenceBand: ConfidenceBand;
  unknownIngredients: string[];
  mlSignals?: Array<{
    ingredient: string;
    categories: string[];
    confidence: number;
  }>;
};

type RiskHitView = RiskHit & {
  detectedBy?: "rules" | "ml" | "hybrid";
};

const ratingStyles = {
  Safe: {
    icon: <CheckCircle2 size={18} />,
    ring: "#8fe3cf",
    badge: "bg-sea/10 text-sea border border-sea/20"
  },
  "Moderate Risk": {
    icon: <AlertTriangle size={18} />,
    ring: "#f0b429",
    badge: "bg-amber-100 text-amber-700 border border-amber-200"
  },
  "High Risk": {
    icon: <ShieldAlert size={18} />,
    ring: "#ff7a59",
    badge: "bg-coral/10 text-coral border border-coral/20"
  }
} as const;

function detectionLabel(value?: "rules" | "ml" | "hybrid") {
  if (value === "hybrid") {
    return "Rules + classifier";
  }

  if (value === "ml") {
    return "Classifier";
  }

  return "Direct ingredient match";
}

function confidenceTone(band: ConfidenceBand) {
  if (band === "Strong Evidence") {
    return "bg-sea/10 text-sea border border-sea/20";
  }

  if (band === "Moderate Evidence") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }

  return "bg-coral/10 text-coral border border-coral/20";
}

export function AnalysisResults({ predictions, loading }: { predictions: SafetyPrediction[]; loading: boolean }) {
  if (loading) {
    return <div className="mt-5 rounded-[28px] border border-ink/8 bg-white/80 p-6 text-sm text-ink/60 panel-outline">Running OCR-normalized ingredient analysis and risk scoring...</div>;
  }

  if (!predictions.length) {
    return <div className="mt-5 rounded-[28px] border border-ink/8 bg-white/80 p-6 text-sm text-ink/60 panel-outline">No analysis yet. Scan an ingredient label and choose whether to compare one profile or all profiles.</div>;
  }

  return (
    <div className="mt-5 grid gap-4">
      {(predictions as SafetyPredictionView[]).map((prediction: SafetyPredictionView) => {
        const style = ratingStyles[prediction.rating as keyof typeof ratingStyles];
        return (
          <article key={prediction.profileId} className="spotlight-card rounded-[30px] border border-ink/8 p-5 shadow-sm shadow-ink/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="section-title text-sm font-semibold uppercase text-ink/45">Profile result</p>
                <h3 className="mt-2 font-display text-2xl font-semibold">{prediction.profileName}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${style.badge}`}>
                  {style.icon}
                  {prediction.rating}
                </div>
                <div className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${confidenceTone(prediction.confidenceBand)}`}>
                  {prediction.confidenceBand}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr]">
              <div className="flex items-center justify-center">
                <div
                  className="metric-ring grid h-32 w-32 place-items-center rounded-full"
                  style={{ ["--value" as string]: `${Math.round(prediction.confidence * 100)}%`, background: `conic-gradient(${style.ring} ${Math.round(prediction.confidence * 100)}%, rgba(19,34,56,0.08) 0)` }}
                >
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-sm">
                    <span className="text-3xl font-semibold">{Math.round(prediction.confidence * 100)}%</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-ink/45">Confidence</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                {prediction.unknownIngredients.length ? (
                  <div className="rounded-[22px] border border-coral/20 bg-coral/5 p-4 text-sm text-ink/70">
                    <p className="font-medium text-coral">Uncertain ingredients detected</p>
                    <p className="mt-2 leading-6">
                      These ingredients have weak or incomplete knowledge coverage and can lower the trustworthiness of this result.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prediction.unknownIngredients.map((ingredient: string) => (
                        <span key={`${prediction.profileId}-unknown-${ingredient}`} className="rounded-full bg-white px-3 py-2 text-xs text-ink/70 shadow-sm">
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {prediction.matchedAllergens.length ? (
                  prediction.matchedAllergens.map((rawHit: RiskHit) => {
                    const hit = rawHit as RiskHitView;
                    return (
                      <div key={`${prediction.profileId}-${hit.ingredient}`} className="rounded-[22px] bg-white/90 p-4 panel-outline">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{hit.matchedName}</p>
                            <p className="text-sm text-ink/60">Categories: {hit.categories.join(", ")}</p>
                          </div>
                          <div className="rounded-full bg-coral/10 px-3 py-1 text-sm font-medium text-coral">
                            {Math.round(hit.probability * 100)}% risk probability
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-sand px-3 py-1 text-ink/60">{detectionLabel(hit.detectedBy)}</span>
                          <span className="rounded-full bg-sand px-3 py-1 text-ink/60">Severity: {hit.severity}</span>
                        </div>
                        {hit.explanation ? <p className="mt-3 text-sm leading-6 text-ink/70">{hit.explanation.description}</p> : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] bg-mint/20 p-4 text-sm text-ink/65">No direct allergen matches were detected for this profile in the current ingredient set.</div>
                )}
                {prediction.mlSignals?.length ? (
                  <div className="rounded-[22px] border border-ink/10 bg-white/80 p-4 text-sm text-ink/65 panel-outline">
                    <p className="font-medium text-ink">Classifier signals</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prediction.mlSignals.map((signal: MlSignal) => (
                        <span key={`${prediction.profileId}-${signal.ingredient}`} className="rounded-full bg-sand px-3 py-2 text-xs text-ink/70">
                          {signal.ingredient}: {signal.categories.join(", ")} ({Math.round(signal.confidence * 100)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-[22px] border border-ink/10 bg-white/80 p-4 text-sm text-ink/65 panel-outline">
                  <p className="font-medium text-ink">Review notes</p>
                  <p className="mt-2 leading-6">{prediction.notes.join(" ")}</p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
