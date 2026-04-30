"use client";

import { useEffect, useState } from "react";
import {
  Github, Globe, Zap, CreditCard, Package,
  Check, X, Loader2, RefreshCw, Lock, Edit3,
} from "lucide-react";

interface IntegrationStatus {
  service: string;
  enabled: boolean;
  metadata: { label: string; description: string };
  updated_at: string;
}

const INTEGRATION_META: Record<string, {
  icon: React.ReactNode;
  color: string;
  label: string;
  description: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  docsUrl: string;
  comingSoon?: boolean;
}> = {
  github: {
    icon: <Github size={18} />,
    color: "#e4e8f0",
    label: "GitHub",
    description: "Pulls commit activity, last push, open issues, and repo stats for any project with a GitHub URL.",
    tokenLabel: "Personal Access Token",
    tokenPlaceholder: "github_pat_...",
    docsUrl: "https://github.com/settings/tokens",
  },
  vercel: {
    icon: <Zap size={18} />,
    color: "#e4e8f0",
    label: "Vercel",
    description: "Shows live deployment status, latest deploy info, and deploy history for projects hosted on Vercel.",
    tokenLabel: "Access Token",
    tokenPlaceholder: "vcp_...",
    docsUrl: "https://vercel.com/account/tokens",
  },
  netlify: {
    icon: <Globe size={18} />,
    color: "#00ad9f",
    label: "Netlify",
    description: "Shows site status and latest deploy for projects hosted on Netlify.",
    tokenLabel: "Personal Access Token",
    tokenPlaceholder: "nfp_...",
    docsUrl: "https://app.netlify.com/user/applications",
  },
  stripe: {
    icon: <CreditCard size={18} />,
    color: "#635bff",
    label: "Stripe",
    description: "Auto-pulls monthly revenue, MRR, and subscription counts directly from Stripe — replaces manual revenue entry.",
    tokenLabel: "Secret Key",
    tokenPlaceholder: "sk_live_...",
    docsUrl: "https://dashboard.stripe.com/apikeys",
  },
  expo: {
    icon: <Package size={18} />,
    color: "#4630eb",
    label: "Expo EAS",
    description: "Tracks remaining build minutes, active builds, and app store submission status.",
    tokenLabel: "Access Token",
    tokenPlaceholder: "expo_...",
    docsUrl: "https://expo.dev/accounts/[account]/settings/access-tokens",
    comingSoon: true,
  },
};

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, "ok" | "fail" | "testing">>({});

  const fetchStatuses = async () => {
    const res = await fetch("/api/integrations/list");
    const { integrations } = await res.json();
    setStatuses(integrations ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchStatuses(); }, []);

  const saveToken = async (service: string) => {
    if (!tokenInput.trim()) return;
    setSaving(true);
    await fetch("/api/integrations/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, token: tokenInput.trim(), enabled: true }),
    });
    setSaving(false);
    setEditingService(null);
    setTokenInput("");
    fetchStatuses();
  };

  const testIntegration = async (service: string) => {
    setTestResults((prev) => ({ ...prev, [service]: "testing" }));
    try {
      let res: Response;
      if (service === "github") {
        res = await fetch("/api/integrations/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl: "https://github.com/michaelmatthews3232-lgtm/builder-os" }),
        });
      } else if (service === "vercel") {
        res = await fetch("/api/integrations/vercel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectName: "builder-os" }),
        });
      } else if (service === "netlify") {
        res = await fetch("/api/integrations/netlify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectName: "" }),
        });
      } else if (service === "stripe") {
        res = await fetch("/api/integrations/stripe");
      } else {
        setTestResults((prev) => ({ ...prev, [service]: "fail" }));
        return;
      }
      setTestResults((prev) => ({ ...prev, [service]: res.ok ? "ok" : "fail" }));
    } catch {
      setTestResults((prev) => ({ ...prev, [service]: "fail" }));
    }
  };

  const connectedServices = new Set(statuses.filter((s) => s.enabled).map((s) => s.service));

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>;

  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Integrations</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Connect external services to pull live data into your projects.
          Tokens are stored encrypted in your private Supabase database — never in code or git.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(INTEGRATION_META).map(([service, meta]) => {
          const isConnected = connectedServices.has(service);
          const status = statuses.find((s) => s.service === service);
          const testResult = testResults[service];
          const isEditing = editingService === service;

          return (
            <div
              key={service}
              className="card"
              style={{
                padding: "20px 22px",
                opacity: meta.comingSoon ? 0.6 : 1,
                borderColor: isConnected ? "rgba(99,102,241,0.2)" : undefined,
              }}
            >
              <div className="flex items-start gap-4">
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: meta.color, flexShrink: 0 }}>
                  {meta.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{meta.label}</span>
                    {meta.comingSoon ? (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: 4, fontWeight: 600 }}>COMING SOON</span>
                    ) : isConnected ? (
                      <span style={{ fontSize: 10, color: "#34d399", background: "rgba(52,211,153,0.1)", padding: "2px 8px", borderRadius: 4, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check size={9} /> CONNECTED
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>NOT SET</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 10 }}>
                    {meta.description}
                  </p>

                  {status?.updated_at && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                      Last updated {new Date(status.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}

                  {isEditing && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <div style={{ position: "relative", flex: 1 }}>
                        <Lock size={11} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                        <input
                          className="input-base"
                          style={{ paddingLeft: 28, fontSize: 12, fontFamily: "JetBrains Mono, monospace" }}
                          placeholder={meta.tokenPlaceholder}
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          type="password"
                          autoFocus
                        />
                      </div>
                      <button className="btn-primary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => saveToken(service)} disabled={saving || !tokenInput.trim()}>
                        {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                      </button>
                      <button className="btn-ghost" style={{ fontSize: 12, padding: "8px 10px" }} onClick={() => { setEditingService(null); setTokenInput(""); }}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {!meta.comingSoon && (
                  <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                    {isConnected && !isEditing && (
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}
                        onClick={() => testIntegration(service)}
                        disabled={testResult === "testing"}
                      >
                        {testResult === "testing" ? (
                          <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                        ) : testResult === "ok" ? (
                          <Check size={11} style={{ color: "#34d399" }} />
                        ) : testResult === "fail" ? (
                          <X size={11} style={{ color: "#f87171" }} />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        {testResult === "ok" ? "Working" : testResult === "fail" ? "Failed" : "Test"}
                      </button>
                    )}
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}
                      onClick={() => { setEditingService(service); setTokenInput(""); }}
                    >
                      <Edit3 size={11} />
                      {isConnected ? "Update" : "Connect"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: "14px 18px", background: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.15)" }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-secondary)" }}>Security note:</strong> All tokens are stored in your private Supabase database with Row Level Security available.
          They are only used server-side in API routes — never exposed to the browser or included in any source code.
        </p>
      </div>
    </div>
  );
}
