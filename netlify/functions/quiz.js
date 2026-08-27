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

  try {
    const url = API_URL + "?key=" + encodeURIComponent(API_KEY);
    const resp = await fetch(url);
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
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch questions from upstream" })
    };
  }
};
