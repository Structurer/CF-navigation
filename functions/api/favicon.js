export async function onRequestGet(c) {
  const urlParam = new URL(c.request.url).searchParams.get("url");
  if (!urlParam) {
    return new Response(JSON.stringify({ error: "URL required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const targetUrl = new URL(urlParam);
    const origin = targetUrl.origin;
    let base64 = null;
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 5000);
    });
    
    const fetchWithTimeout = (url, options = {}) => {
      return Promise.race([
        fetch(url, {
          ...options,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ...options.headers
          }
        }),
        timeoutPromise
      ]);
    };
    
    const arrayBufferToBase64 = (buffer) => {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };
    
    try {
      const faviconUrl = origin + "/favicon.ico";
      const response = await fetchWithTimeout(faviconUrl);
      
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        
        if (contentType.startsWith("image/") || contentType === "image/x-icon") {
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer.byteLength > 0) {
            const ext = contentType.includes("png") ? "image/png" : 
                        contentType.includes("svg") ? "image/svg+xml" : 
                        contentType.includes("gif") ? "image/gif" : "image/x-icon";
            base64 = "data:" + ext + ";base64," + arrayBufferToBase64(arrayBuffer);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching favicon.ico:", e.message);
    }
    
    if (!base64) {
      try {
        const htmlResponse = await fetchWithTimeout(targetUrl.href);
        if (htmlResponse.ok) {
          const html = await htmlResponse.text();
          
          const patterns = [
            /<link\s+rel=["']icon["']\s+href=["']([^"']+)["']/i,
            /<link\s+rel=["']shortcut\s+icon["']\s+href=["']([^"']+)["']/i,
            /<link\s+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
            /<link\s+href=["']([^"']+)["'][^>]+rel=["']icon["']/i
          ];
          
          let iconHref = null;
          for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              iconHref = match[1];
              break;
            }
          }
          
          if (iconHref) {
            if (!iconHref.startsWith("http")) {
              if (iconHref.startsWith("//")) {
                iconHref = "https:" + iconHref;
              } else {
                iconHref = new URL(iconHref, origin).href;
              }
            }
            
            const iconResponse = await fetchWithTimeout(iconHref);
            if (iconResponse.ok) {
              const contentType = iconResponse.headers.get("content-type") || "image/png";
              const arrayBuffer = await iconResponse.arrayBuffer();
              if (arrayBuffer.byteLength > 0) {
                base64 = "data:" + contentType + ";base64," + arrayBufferToBase64(arrayBuffer);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error parsing HTML for favicon:", e.message);
      }
    }
    
    return new Response(JSON.stringify({ success: !!base64, base64: base64 || null }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Overall error:", e.message);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
