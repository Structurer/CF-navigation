export async function onRequestPost(context) {
  try {
    const authHeader = context.request.headers.get("Authorization");
    if (authHeader !== `Bearer ${context.env.API_KEY}`) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const requestBody = await context.request.text();
    let data;
    try {
      data = JSON.parse(requestBody);
    } catch (parseError) {
      return new Response(JSON.stringify({ success: false, error: `JSON Parse Error: ${parseError.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ success: false, error: "Invalid data structure" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    await context.env.NAV_DATA.put("nav_data", JSON.stringify(data));
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: `Unexpected Error: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
