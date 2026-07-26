var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (path === "/api/get") {
      return handleGetRequest(request, env);
    } else if (path === "/api/save") {
      return handleSaveRequest(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function handleGetRequest(request, env) {
  try {
    const data = await env.NAV_DATA.get("nav_data");
    if (data) {
      return new Response(data, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else {
      return new Response(JSON.stringify({ navList: [], operateLog: [] }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to get data" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleGetRequest, "handleGetRequest");
async function handleSaveRequest(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    console.log("Authorization Header:", authHeader);
    console.log("Expected API Key:", env.API_KEY);
    if (authHeader !== `Bearer ${env.API_KEY}`) {
      console.log("Unauthorized access attempt");
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const requestBody = await request.text();
    console.log("Request Body:", requestBody);
    let data;
    try {
      data = JSON.parse(requestBody);
      console.log("Parsed Data:", JSON.stringify(data));
    } catch (parseError) {
      console.log("JSON Parse Error:", parseError.message);
      return new Response(JSON.stringify({ success: false, error: `JSON Parse Error: ${parseError.message}` }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    if (!data || typeof data !== "object") {
      console.log("Invalid data structure");
      return new Response(JSON.stringify({ success: false, error: "Invalid data structure" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    try {
      await env.NAV_DATA.put("nav_data", JSON.stringify(data));
      console.log("Data saved successfully to KV");
    } catch (kvError) {
      console.log("KV Put Error:", kvError.message);
      return new Response(JSON.stringify({ success: false, error: `KV Put Error: ${kvError.message}` }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.log("Unexpected Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: `Unexpected Error: ${error.message}` }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleSaveRequest, "handleSaveRequest");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
