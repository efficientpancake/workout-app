// Food search goes through here because Open Food Facts doesn't allow its
// search to be called straight from a browser. Also sends the app name, which
// Open Food Facts asks every app to do. Protected by the sign-in lock like
// every other page.
const OFF_SEARCH = "https://search.openfoodfacts.org/search";
const FIELDS = "code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments";

export async function GET(request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ products: [] });

  const params = new URLSearchParams({
    q: q.slice(0, 100),
    page_size: "30",
    langs: "en",
    fields: FIELDS,
  });

  try {
    const res = await fetch(`${OFF_SEARCH}?${params}`, {
      headers: { "User-Agent": "FifthGearFitness/0.1 (https://github.com/efficientpancake/workout-app)" },
      cache: "no-store",
    });
    if (res.status === 429 || res.status === 503) {
      return Response.json({ error: "busy" }, { status: 503 });
    }
    if (!res.ok) return Response.json({ error: "failed" }, { status: 502 });
    const data = await res.json();
    return Response.json({ products: data.hits || [] });
  } catch {
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
