"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Lightbulb,
  Zap,
  Terminal,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/today", label: "Today", icon: Zap },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      style={{
        width: "var(--sidebar-w)",
        background: "rgba(10,13,20,0.95)",
        borderRight: "1px solid var(--border)",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 18px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{
              width: 30,
              height: 30,
              background: "var(--accent)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Terminal size={15} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div
              className="font-mono"
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}
            >
              Builder OS
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Control Portal
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--accent)" : "var(--text-secondary)",
                background: active ? "var(--accent-dim)" : "transparent",
                border: `1px solid ${active ? "var(--border-accent)" : "transparent"}`,
                textDecoration: "none",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} />
              {label}
              {href === "/today" && (
                <span
                  style={{
                    marginLeft: "auto",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    animation: "pulse-accent 2s ease-in-out infinite",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "14px 18px",
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        v0.1.0 — personal
      </div>
    </aside>
  );
}
