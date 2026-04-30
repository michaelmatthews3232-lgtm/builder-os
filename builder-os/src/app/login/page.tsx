"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, Terminal } from "lucide-react";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from = searchParams.get("from") ?? "/";
      router.push(from);
      router.refresh();
    } else {
      setError("Incorrect password");
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: "32px 28px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44,
          background: "var(--accent-dim)",
          borderRadius: 11,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
        }}>
          <Lock size={20} style={{ color: "var(--accent)" }} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Private Access</h1>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Enter your password to continue</p>
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <input
            className="input-base"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ fontSize: 14, padding: "12px 14px" }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !password.trim()}
          style={{ padding: "12px", fontSize: 14, width: "100%", justifyContent: "center", opacity: loading || !password.trim() ? 0.6 : 1 }}
        >
          {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : "Unlock"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div style={{
            width: 36, height: 36,
            background: "var(--accent)",
            borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Terminal size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Builder OS</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Control Portal</div>
          </div>
        </div>

        <Suspense fallback={<div className="card" style={{ padding: "32px 28px", textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 16 }}>
          Origin Verification Systems LLC — private use only
        </p>
      </div>
    </div>
  );
}
