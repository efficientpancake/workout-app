// "Look it up online": when the free food databases don't have a food (or
// have it with no nutrition), Claude searches the web for its nutrition label
// and sends back the numbers for you to check before saving.
// Costs a few cents per lookup, so it only runs when you tap the button.
// Protected by the sign-in lock like every other page.
import Anthropic from "@anthropic-ai/sdk";

// Sonnet: plenty for reading a nutrition label, and cheaper than Opus.
const MODEL = "claude-sonnet-5-5";

// No "number or null" types: the API limits those, so a missing value is -1
// and a missing piece of text is "".
const NUM = { type: "number" };
const NUTRIENTS = {
  type: "object",
  additionalProperties: false,
  required: ["kcal", "protein", "carbs", "sugar", "fat", "fiber", "salt"],
  properties: { kcal: NUM, protein: NUM, carbs: NUM, sugar: NUM, fat: NUM, fiber: NUM, salt: NUM },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "name", "brand", "servingLabel", "servingGrams", "per100g", "perServing", "sourceUrl", "sourceName", "note"],
  properties: {
    found: { type: "boolean" },
    name: { type: "string" },
    brand: { type: "string" },
    servingLabel: { type: "string" },
    servingGrams: NUM,
    per100g: NUTRIENTS,
    perServing: NUTRIENTS,
    sourceUrl: { type: "string" },
    sourceName: { type: "string" },
    note: { type: "string" },
  },
};

const SYSTEM = `You find the nutrition label for one food and report its numbers.

Search the web for the food the user names. Prefer, in this order: the brand's own website, a large supermarket's product page (Tesco, Sainsbury's, Waitrose, Ocado, Walmart, Target and similar), then a reputable nutrition site. Copy the numbers from the label as printed. Never estimate or average numbers yourself: if you can't find a label, set found to false.

Fill in per100g and perServing when the label gives them (UK and EU labels usually give per 100 g; US labels give per serving). Units: kcal for energy (if only kJ is printed, divide by 4.184), grams for everything else. Salt in grams: if only sodium is given, salt = sodium x 2.5 (convert mg to g first). Use -1 for any number the label doesn't show (if the label has no per 100 g column, set every per100g value to -1; same for perServing), and "" for any text you don't have. servingLabel is the serving as printed (for example "45 g" or "2/3 cup (55 g)"), and servingGrams is its weight in grams.

If several flavors or sizes exist and the user didn't say which, pick the most common one and name it exactly in name, and say so in note. sourceUrl is the page the numbers came from; sourceName is that site's name. Keep note to one short sentence, or "".`;

// A web search can take 20-40 seconds; give it room before Vercel cuts it off.
export const maxDuration = 60;

let client = null;

// The JSON label, even if Claude wrote a few words around it.
function readLabel(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "nokey" }, { status: 503 });
  }
  let query = "";
  try {
    query = String((await request.json()).query || "").trim().slice(0, 120);
  } catch {}
  if (!query) return Response.json({ error: "empty" }, { status: 400 });

  client ??= new Anthropic();
  const messages = [{ role: "user", content: `Find the nutrition label for: ${query}` }];

  try {
    let response;
    // A long search can pause partway; send it back so it carries on.
    for (let i = 0; i < 4; i++) {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        // If Sonnet 5.5 declines, the API retries on another model by itself.
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 3 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 2, max_content_tokens: 8000 },
        ],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }

    if (response.stop_reason === "refusal") return Response.json({ error: "failed", detail: "declined" }, { status: 502 });
    const texts = response.content.filter((b) => b.type === "text").map((b) => b.text);
    const label = readLabel(texts.join("")) || readLabel(texts[texts.length - 1] || "");
    if (!label) {
      console.error("food-lookup: unreadable answer", response.stop_reason, texts.join("").slice(0, 500));
      return Response.json({ error: "failed", detail: `unreadable answer (${response.stop_reason})` }, { status: 502 });
    }
    if (!label.found) return Response.json({ found: false });
    const food = toFood(label);
    if (!food) return Response.json({ found: false });
    return Response.json({ found: true, food, sourceUrl: label.sourceUrl || null, sourceName: label.sourceName || null, note: label.note || null });
  } catch (err) {
    console.error("food-lookup:", err);
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 503 });
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "badkey" }, { status: 503 });
    const message = String(err?.error?.error?.message || err?.message || "unknown");
    if (/credit balance/i.test(message)) return Response.json({ error: "credit" }, { status: 503 });
    if (err?.status === 529) return Response.json({ error: "busy" }, { status: 503 });
    // Shown on screen so a screenshot tells us what went wrong.
    const detail = `${err?.status ?? "no status"}: ${message}`.slice(0, 160);
    return Response.json({ error: "failed", detail }, { status: 502 });
  }
}

const r1 = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null);
const clean = (n) => n && { kcal: r1(n.kcal) == null ? null : Math.round(n.kcal), protein: r1(n.protein), carbs: r1(n.carbs), sugar: r1(n.sugar), fat: r1(n.fat), fiber: r1(n.fiber), salt: r1(n.salt) };

// Into the app's food shape. Per 100 g when the label has it (so grams work),
// otherwise per serving.
function toFood(l) {
  const per100 = clean(l.per100g);
  const perServing = clean(l.perServing);
  const grams = r1(l.servingGrams);
  const base = {
    name: l.name || "Unnamed food",
    brand: l.brand || null,
    barcode: null,
    servingLabel: l.servingLabel || null,
    source: "web",
    sourceUrl: l.sourceUrl || null,
  };
  if (per100?.kcal != null) return { ...base, basis: "per100g", servingGrams: grams, nutrients: per100 };
  if (perServing?.kcal != null) return { ...base, basis: "perServing", servingGrams: grams, nutrients: perServing };
  return null;
}
