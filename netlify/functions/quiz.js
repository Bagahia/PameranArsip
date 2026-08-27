exports.handler = async function (event) {
  const API_URL = process.env.GOOGLE_SHEET_API_URL;
  const API_KEY = process.env.GOOGLE_SHEET_API_KEY;

  if (!API_URL || !API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error" })
    };
  }

  const url = API_URL + "?key=" + encodeURIComponent(API_KEY);

  // Add timeout (8 seconds)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await resp.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60" // cache 60s in browser
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    clearTimeout(timeout);
    const message = err.name === "AbortError"
      ? "Upstream request timed out"
      : "Failed to fetch questions from upstream";
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: message })
    };
  }
};
