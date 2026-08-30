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

  // --- GET: Fetch questions or check attempt ---
  if (event.httpMethod === "GET") {
    const queryParams = new URLSearchParams(event.queryStringParameters || {});
    const action = queryParams.get("action");

    let url = API_URL + "?key=" + encodeURIComponent(API_KEY);

    if (action === "checkAttempt") {
      const name = queryParams.get("name") || "";
      const fingerprint = queryParams.get("fingerprint") || "";
      url += "&action=checkAttempt&name=" + encodeURIComponent(name) + "&fingerprint=" + encodeURIComponent(fingerprint);
    }

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
          "Cache-Control": "no-store"
        },
        body: JSON.stringify(data)
      };
    } catch (err) {
      clearTimeout(timeout);
      const message = err.name === "AbortError"
        ? "Upstream request timed out"
        : "Failed to fetch from upstream";
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: message })
      };
    }
  }

  // --- POST: Submit quiz or admin actions ---
  if (event.httpMethod === "POST") {
    const url = API_URL + "?key=" + encodeURIComponent(API_KEY);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body,
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await resp.json();

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify(data)
      };
    } catch (err) {
      clearTimeout(timeout);
      const message = err.name === "AbortError"
        ? "Upstream request timed out"
        : "Failed to submit to upstream";
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: message })
      };
    }
  }

  return {
    statusCode: 405,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Method not allowed" })
  };
};
