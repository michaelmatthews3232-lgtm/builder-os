import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { content, filename } = await req.json() as { content: string; filename: string };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract every important piece of information from this file that someone would need to manage, maintain, or access this project. Focus on anything that is hard to find later or changes over time.

Look for:
- Usernames and passwords / login credentials
- API keys, tokens, secrets, client IDs
- Dashboard and admin panel URLs
- Bank accounts, payment methods, billing info
- App store accounts, developer accounts
- Third-party service accounts (Stripe, Firebase, RevenueCat, etc.)
- Important email addresses or phone numbers
- License keys or activation codes
- Any other critical reference info

Return ONLY a JSON array. Each item must have:
- "label": short descriptive name (e.g. "Stripe API Key", "Admin Login", "Apple Developer Account")
- "value": the actual value or info
- "category": one of exactly: credential, api_key, url, payment, account, note
- "notes": one brief sentence explaining what this is used for and what breaks if it changes (e.g. "Handles all payment processing — changing this breaks checkout", "Admin access to Firebase console", "URL where the app is publicly deployed")

Example format:
[
  { "label": "Stripe Secret Key", "value": "sk_live_abc123", "category": "api_key", "notes": "Handles all payment processing — changing this breaks checkout" },
  { "label": "Admin Login", "value": "admin@example.com / password123", "category": "credential", "notes": "Login for the admin dashboard" },
  { "label": "Stripe Dashboard", "value": "https://dashboard.stripe.com/...", "category": "url", "notes": "Where you manage payments, refunds, and customer subscriptions" }
]

If nothing relevant is found, return an empty array [].
Return ONLY the JSON array, no explanation.

File: ${filename}
Content:
${content.slice(0, 6000)}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ items });
  } catch (err) {
    console.error("extract-knowledge error:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
