import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";

// Per-instance only; serverless instances may not share state, so this is best-effort.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000;
const attempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkRate(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 0, firstAt: now, lockedUntil: 0 });
  }
  return { ok: true };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip) ?? { count: 0, firstAt: now, lockedUntil: 0 };
  if (now - entry.firstAt > WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = now + LOCKOUT_MS;
  attempts.set(ip, entry);
}

function recordSuccess(ip: string) {
  attempts.delete(ip);
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rate = checkRate(ip);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const { password } = await req.json();
  const authPassword = process.env.AUTH_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;

  if (!authPassword || !authSecret) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  if (typeof password !== "string" || !constantTimeEqual(password, authPassword)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  recordSuccess(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("builder_auth", authSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("builder_auth");
  return res;
}
