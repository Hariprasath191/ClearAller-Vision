import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search, ShieldCheck, Star } from "lucide-react";
import { api } from "../lib/api";

type ProductCard = {
  product: {
    id: string;
    name: string;
    brand?: string;
    category: string;
    source: string;
    sourceSite?: string;
    imageUrl?: string;
    purchaseUrl?: string;
    reviewRating?: number;
    reviewCount?: number;
  };
  predictions: Array<{ profileId: string; profileName: string; rating: string }>;
  safestLabel: string;
  recommendationScore: number;
  recommendationNote: string;
};

export function ProductSearchPanel({
  userId,
  profileIds,
  initialQuery,
  lens
}: {
  userId?: string;
  profileIds: string[];
  initialQuery: string;
  lens: "packaged-food" | "cosmetic";
}) {
  const [query, setQuery] = useState(initialQuery);
  const [searchScope, setSearchScope] = useState<"selected" | "all">("selected");
  const [submittedQuery, setSubmittedQuery] = useState("");

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const searchQuery = useQuery({
    queryKey: ["product-search", submittedQuery, userId, searchScope, profileIds.join(",")],
    enabled: Boolean(userId && submittedQuery.trim().length >= 2 && (searchScope === "all" || profileIds.length > 0)),
    queryFn: async () => {
      const response = await api.get<ProductCard[]>("/api/search/products", {
        params: {
          userId,
          q: submittedQuery,
          lens,
          scope: searchScope,
          profileIds: searchScope === "selected" ? profileIds.join(",") : undefined
        }
      });
      return response.data;
    }
  });

  return (
    <div className="glass-card p-6 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-title text-sm font-semibold uppercase text-ink/45">Product safety search</p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold">
            {lens === "cosmetic" ? "Search cosmetics and get the top 3 safe picks matched to saved beauty preferences." : "Search packaged foods and get the top 3 safe picks for the selected allergy profiles."}
          </h2>
          <p className="mt-2 text-sm text-ink/55">
            {lens === "cosmetic"
              ? "Cosmetic search currently prioritizes the fastest reliable ingredient source so results stay usable and profile-safe."
              : "Food search compares live catalog matches and filters them against the selected allergy profiles."}
          </p>
        </div>
        <div className="w-full max-w-2xl space-y-3">
          <div className="rounded-[24px] bg-white/75 p-3 panel-outline">
            <p className="text-sm font-medium text-ink/60">Run product search for</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => setSearchScope("selected")}
                className={`rounded-[20px] px-4 py-3 text-left ${searchScope === "selected" ? "bg-ink text-white" : "bg-sand text-ink/70"}`}
              >
                <p className="font-semibold">Selected profiles</p>
                <p className={`mt-1 text-sm ${searchScope === "selected" ? "text-white/75" : "text-ink/55"}`}>Use the profiles currently picked on the page.</p>
              </button>
              <button
                onClick={() => setSearchScope("all")}
                className={`rounded-[20px] px-4 py-3 text-left ${searchScope === "all" ? "bg-coral text-white" : "bg-sand text-ink/70"}`}
              >
                <p className="font-semibold">All profiles</p>
                <p className={`mt-1 text-sm ${searchScope === "all" ? "text-white/80" : "text-ink/55"}`}>Search for the whole saved account.</p>
              </button>
            </div>
            {searchScope === "selected" ? (
              <div className="mt-3 rounded-2xl bg-sand px-4 py-3 text-sm text-ink/60">
                {profileIds.length ? `Using ${profileIds.length} currently selected profile${profileIds.length > 1 ? "s" : ""}.` : "No selected profiles yet. Choose a profile on the page or switch to all profiles."}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={lens === "cosmetic" ? "Try cleanser, body lotion, serum, conditioner, or sunscreen" : "Try biscuits, cereal, noodles, snacks, or baby food"}
            className="panel-outline rounded-2xl bg-white px-4 py-3"
          />
          <button
            onClick={() => setSubmittedQuery(query.trim())}
            disabled={!query.trim() || (searchScope === "selected" && profileIds.length === 0)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={18} />
            Search
          </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {searchQuery.data?.map((entry) => (
          <article key={entry.product.id} className="spotlight-card rounded-[28px] border border-ink/8 p-4 shadow-sm shadow-ink/5">
            {entry.product.imageUrl ? (
              <img src={entry.product.imageUrl} alt={entry.product.name} className="h-44 w-full rounded-[20px] object-cover" />
            ) : (
              <div className="grid h-44 place-items-center rounded-[20px] bg-sand text-sm text-ink/45">No image available</div>
            )}
            <div className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                    <ShieldCheck size={12} />
                    {entry.product.category}
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold">{entry.product.name}</h3>
                  <p className="text-sm text-ink/55">{entry.product.brand ?? entry.product.source}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/40">{entry.product.source}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    entry.safestLabel === "Safe" ? "bg-sea/10 text-sea" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {entry.safestLabel === "Safe" ? "Safe pick" : "Safest available"}
                </span>
              </div>
              <div className="mt-4 rounded-[20px] bg-white/85 px-4 py-3 text-sm text-ink/65 panel-outline">
                {entry.recommendationNote}
              </div>
              {entry.product.reviewRating ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  <Star size={12} />
                  {entry.product.reviewRating.toFixed(1)}/5 review signal
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.predictions.map((prediction) => (
                  <span key={`${entry.product.id}-${prediction.profileId}`} className="rounded-full bg-white px-3 py-2 text-xs text-ink/65 shadow-sm">
                    {prediction.profileName}: approved
                  </span>
                ))}
              </div>
              <div className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-ink/40">Recommendation score {Math.round(entry.recommendationScore)}</div>
              {entry.product.purchaseUrl ? (
                <a href={entry.product.purchaseUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sea">
                  Open source listing
                  <ArrowUpRight size={16} />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {searchQuery.isLoading ? <div className="mt-4 text-sm text-ink/60">Searching live product data and filtering only the safest usable recommendations...</div> : null}
      {!searchQuery.isLoading && submittedQuery.trim().length >= 2 && searchQuery.data?.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm text-ink/60">No safe matches found for this search yet. Try a broader product type or another profile mode.</div>
      ) : null}
    </div>
  );
}
