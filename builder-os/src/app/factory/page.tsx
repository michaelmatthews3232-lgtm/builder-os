"use client";

import { useState } from "react";
import {
  Factory,
  Search,
  Wand2,
  Upload,
  ChevronRight,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Download,
  AlertTriangle,
  DollarSign,
  Sparkles,
} from "lucide-react";

const PRODUCT_TYPES = [
  {
    value: "prompt_pack",
    label: "Prompt Pack",
    description: "300–400 AI prompts organized by use case",
    price: "$17–$49",
    time: "~8 min",
  },
  {
    value: "email_swipe",
    label: "Email Swipe File",
    description: "25 ready-to-send email templates",
    price: "$27–$67",
    time: "~3 min",
  },
  {
    value: "pdf_guide",
    label: "PDF Guide",
    description: "10-section practical guide, ~3,000 words",
    price: "$9–$25",
    time: "~4 min",
  },
  {
    value: "social_pack",
    label: "Social Content Pack",
    description: "50 ready-to-post pieces with hooks",
    price: "$12–$37",
    time: "~3 min",
  },
  {
    value: "checklist",
    label: "Checklist / Framework",
    description: "80–120 item actionable checklist",
    price: "$7–$29",
    time: "~2 min",
  },
];

interface ProductIdea {
  title: string;
  hook: string;
  description: string;
  price: number;
  deliverable: string;
  why_it_wins: string;
}

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "Research" },
    { n: 2, label: "Generate" },
    { n: 3, label: "Publish" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                background: current >= s.n ? "var(--accent)" : "var(--bg-hover)",
                color: current >= s.n ? "#fff" : "var(--text-muted)",
                border: `1px solid ${current >= s.n ? "var(--accent)" : "var(--border)"}`,
                flexShrink: 0,
              }}
            >
              {current > s.n ? <CheckCircle2 size={14} /> : s.n}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: current === s.n ? 700 : 500,
                color: current === s.n ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                width: 48,
                height: 1,
                background: current > s.n ? "var(--accent)" : "var(--border)",
                margin: "0 10px",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function FactoryPage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [niche, setNiche] = useState("");
  const [productType, setProductType] = useState("prompt_pack");
  const [researching, setResearching] = useState(false);
  const [ideas, setIdeas] = useState<ProductIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<ProductIdea | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  // Step 2
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [gTitle, setGTitle] = useState("");
  const [gDescription, setGDescription] = useState("");
  const [gFilename, setGFilename] = useState("");
  const [gWordCount, setGWordCount] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Step 3
  const [price, setPrice] = useState(27);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ product_url: string; edit_url: string; file_uploaded: boolean; warning?: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const research = async () => {
    if (!niche.trim()) return;
    setResearching(true);
    setResearchError(null);
    setIdeas([]);
    setSelectedIdea(null);

    const res = await fetch("/api/factory/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche, product_type: productType }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setResearchError(data.error ?? "Research failed");
    } else {
      setIdeas(data.ideas ?? []);
    }
    setResearching(false);
  };

  const selectIdea = (idea: ProductIdea) => {
    setSelectedIdea(idea);
    setPrice(idea.price);
    setStep(2);
    setContent(null);
    setGTitle("");
    setGDescription("");
    setPublished(null);
  };

  const generate = async () => {
    if (!selectedIdea) return;
    setGenerating(true);
    setGenerateError(null);
    setContent(null);

    const typeLabel = PRODUCT_TYPES.find((t) => t.value === productType)?.label ?? productType;
    setGenerateStatus(`Claude is generating your ${typeLabel}...`);

    const res = await fetch("/api/factory/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: selectedIdea, niche, product_type: productType }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setGenerateError(data.error ?? "Generation failed");
    } else {
      setContent(data.content);
      setGTitle(data.title);
      setGDescription(data.description);
      setGFilename(data.filename);
      setGWordCount(data.word_count ?? 0);
      setGenerateStatus("");
    }
    setGenerating(false);
  };

  const downloadContent = () => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = gFilename || "product.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const publish = async () => {
    if (!content || !gTitle) return;
    setPublishing(true);
    setPublishError(null);

    const res = await fetch("/api/factory/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: gTitle,
        description: gDescription,
        price_cents: price * 100,
        content,
        filename: gFilename,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setPublishError(data.error ?? "Publish failed");
    } else {
      setPublished(data);
      setStep(3);
    }
    setPublishing(false);
  };

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Factory size={20} style={{ color: "var(--accent)" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Gumroad Factory</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Research what sells → generate the product with Claude → publish to Gumroad automatically.
          Each run produces a market-ready digital product in minutes.
        </p>
      </div>

      <StepIndicator current={step} />

      {/* ─── STEP 1: Research ──────────────────────────────── */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start" }}>
          {/* Left: input form */}
          <div className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Target Audience + Format
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Who is your buyer?
              </label>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && research()}
                placeholder="e.g. freelance copywriters, Etsy sellers, SaaS founders..."
                className="input"
                style={{ width: "100%", fontSize: 13 }}
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
                Specific = better ideas. "Freelance UX designers on Upwork" beats "designers".
              </p>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                Product Format
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {PRODUCT_TYPES.map((pt) => {
                  const active = productType === pt.value;
                  return (
                    <button
                      key={pt.value}
                      onClick={() => setProductType(pt.value)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                        background: active ? "var(--accent-dim)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: active ? 700 : 600, color: active ? "var(--accent)" : "var(--text-primary)" }}>
                          {pt.label}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{pt.description}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: active ? "var(--accent)" : "#34d399" }}>{pt.price}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{pt.time}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={research}
              disabled={researching || !niche.trim()}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
            >
              {researching ? (
                <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Researching market...</>
              ) : (
                <><Search size={13} /> Research This Niche</>
              )}
            </button>
          </div>

          {/* Right: idea cards */}
          <div>
            {researchError && (
              <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, fontSize: 13, color: "#f87171", marginBottom: 14 }}>
                <AlertTriangle size={12} style={{ display: "inline", marginRight: 6 }} />
                {researchError}
              </div>
            )}

            {researching && (
              <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
                <Loader2 size={24} style={{ color: "var(--accent)", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Researching the market...</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Claude is analyzing demand signals and competition for {niche}</p>
              </div>
            )}

            {ideas.length > 0 && !researching && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                  5 product ideas for <strong style={{ color: "var(--text-primary)" }}>{niche}</strong> — pick one to generate:
                </p>
                {ideas.map((idea, i) => (
                  <div
                    key={i}
                    className="card"
                    style={{ padding: "16px 18px", cursor: "pointer" }}
                    onClick={() => selectIdea(idea)}
                  >
                    <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-dim)", padding: "2px 8px", borderRadius: 4 }}>
                        IDEA {i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>
                        {idea.title}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399", flexShrink: 0 }}>
                        ${idea.price}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>
                      {idea.description}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                        {idea.why_it_wins}
                      </span>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}
                        onClick={(e) => { e.stopPropagation(); selectIdea(idea); }}
                      >
                        Generate This <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ideas.length === 0 && !researching && !researchError && (
              <div className="card" style={{ padding: "56px 24px", textAlign: "center" }}>
                <Sparkles size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Waiting for your niche</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Enter a target audience and hit Research. Claude will identify 5 specific product opportunities with pricing and positioning.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 2: Generate ──────────────────────────────── */}
      {step === 2 && selectedIdea && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start" }}>
          {/* Left: selected idea + controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Selected idea summary */}
            <div className="card" style={{ padding: "16px 18px", borderColor: "var(--border-accent)", background: "rgba(99,102,241,0.03)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Selected Product
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {selectedIdea.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{selectedIdea.hook}</div>
              <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>Suggested price: ${selectedIdea.price}</div>
            </div>

            {!content ? (
              <button
                className="btn-primary"
                onClick={generate}
                disabled={generating}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 18px" }}
              >
                {generating ? (
                  <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> {generateStatus || "Generating..."}</>
                ) : (
                  <><Wand2 size={14} /> Generate Full Product</>
                )}
              </button>
            ) : (
              <>
                <div className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>
                    Gumroad Listing
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Title</label>
                      <input
                        value={gTitle}
                        onChange={(e) => setGTitle(e.target.value)}
                        className="input"
                        style={{ width: "100%", fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>Price (USD)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <DollarSign size={13} style={{ color: "var(--text-muted)" }} />
                        <input
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          min={1}
                          max={999}
                          className="input"
                          style={{ width: "80px", fontSize: 13, fontWeight: 700 }}
                        />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          (sweet spot: ${selectedIdea.price})
                        </span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                        Description <span style={{ fontWeight: 400 }}>({gDescription.split(" ").length} words)</span>
                      </label>
                      <textarea
                        value={gDescription}
                        onChange={(e) => setGDescription(e.target.value)}
                        className="input"
                        rows={6}
                        style={{ width: "100%", fontSize: 11, lineHeight: 1.6, resize: "vertical" }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={downloadContent}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: "var(--bg-hover)", border: "1px solid var(--border)",
                      color: "var(--text-secondary)", cursor: "pointer",
                    }}
                  >
                    <Download size={12} /> Download .txt
                  </button>
                  <button
                    className="btn-primary"
                    onClick={publish}
                    disabled={publishing || !gTitle}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    {publishing ? (
                      <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Publishing...</>
                    ) : (
                      <><Upload size={12} /> Publish to Gumroad</>
                    )}
                  </button>
                </div>

                {publishError && (
                  <div style={{ padding: "10px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8, fontSize: 12, color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <AlertTriangle size={11} style={{ display: "inline", marginRight: 5 }} />
                    {publishError}
                  </div>
                )}
              </>
            )}

            {generateError && (
              <div style={{ padding: "10px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8, fontSize: 12, color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                <AlertTriangle size={11} style={{ display: "inline", marginRight: 5 }} />
                {generateError}
              </div>
            )}

            <button
              onClick={() => setStep(1)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", textAlign: "left", padding: 0 }}
            >
              ← Back to research
            </button>
          </div>

          {/* Right: content preview */}
          <div>
            {generating && (
              <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
                <Loader2 size={28} style={{ color: "var(--accent)", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  {generateStatus || "Generating..."}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Claude is writing your full product. Prompt packs take ~8 minutes (8 categories × 40 prompts each).
                </p>
              </div>
            )}

            {content && !generating && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={14} style={{ color: "#34d399" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    Product Generated
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {gWordCount.toLocaleString()} words · {Math.round(content.length / 1024)} KB
                  </span>
                </div>
                <pre
                  style={{
                    padding: "16px 18px",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    lineHeight: 1.65,
                    fontFamily: "JetBrains Mono, monospace",
                    maxHeight: 560,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    background: "rgba(0,0,0,0.15)",
                  }}
                >
                  {content.slice(0, 8000)}
                  {content.length > 8000 && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {"\n\n"}... [{Math.round((content.length - 8000) / 1000)}K+ more characters — download to see full product]
                    </span>
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 3: Published ────────────────────────────── */}
      {step === 3 && published && (
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div className="card" style={{ padding: "36px 40px", textAlign: "center", borderColor: "#34d399", background: "rgba(52,211,153,0.03)" }}>
            <CheckCircle2 size={40} style={{ color: "#34d399", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Product Published to Gumroad
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.7 }}>
              Your product is live as a draft. Set the cover image and toggle it to published when you&apos;re ready to sell.
            </p>

            {published.warning && (
              <div style={{ padding: "10px 14px", background: "rgba(251,191,36,0.08)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.2)", fontSize: 12, color: "#fbbf24", marginBottom: 20, textAlign: "left" }}>
                <AlertTriangle size={11} style={{ display: "inline", marginRight: 6 }} />
                {published.warning}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 28 }}>
              <a
                href={published.edit_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              >
                <ExternalLink size={13} /> Open in Gumroad Editor
              </a>
              <button
                onClick={downloadContent}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: "var(--bg-hover)", border: "1px solid var(--border)",
                  color: "var(--text-secondary)", cursor: "pointer",
                }}
              >
                <Download size={13} /> Download .txt File
              </button>
            </div>

            <div style={{ textAlign: "left", padding: "18px 20px", background: "var(--bg-hover)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                Next steps to get sales
              </div>
              {[
                "Add a cover image in the Gumroad editor (Canva → 1280×720px)",
                "Set the product to Published in Gumroad",
                `Post about it on LinkedIn/Twitter: share 1 example prompt/tip from the product`,
                "Find 1 relevant subreddit or community and share a free sample",
                "After 3 products, create a bundle at 20% discount",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < 4 ? 8 : 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--accent-dim)",
                    width: 18, height: 18, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{step}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setStep(1); setIdeas([]); setSelectedIdea(null); setContent(null); setPublished(null); }}
              style={{ marginTop: 20, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}
            >
              ← Make another product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
