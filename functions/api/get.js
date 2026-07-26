export async function onRequestGet(context) {
  try {
    const data = await context.env.NAV_DATA.get("nav_data");
    if (data) {
      return new Response(data, {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ navList: [], operateLog: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to get data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
