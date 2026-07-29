// Cloudflare Pages Function: /api/favicon
// 功能：根据传入的网址(url)获取网站图标，转为 Base64 data URL 返回
//
// 部署到 Cloudflare Pages 后，访问路径：/api/favicon?url=https://example.com
// 本地 (wrangler pages dev)：http://localhost:8788/api/favicon?url=...
//
// 图标获取优先级（按顺序尝试）：
//   1. 直接访问目标网站 origin/favicon.ico （保留用户输入的 http/https）
//   2. 抓取目标网站 HTML，解析 <link rel="icon/shortcut icon"> 的自定义图标 URL
//   3. https://www. + hostname + /favicon.ico
//   4. https:// + hostname + /favicon.ico
//   5. http:// + hostname + /favicon.ico   （旧站点兼容）
//   6. Google S2 favicons（公共代理兜底，sz=128）
//   7. DuckDuckGo ip3 （最后兜底）
//
// 返回格式（前端兼容）：
//   成功：{ success: true,  base64: "data:image/png;base64,xxx", hostname: "..." }
//   失败：{ success: false, error: "..." }

const TIMEOUT_MS = 5000;

// ============================================================
// 工具函数
// ============================================================

function getTargetOrigin(urlStr) {
  try {
    const normalized = /^https?:\/\//i.test(urlStr) ? urlStr : 'https://' + urlStr;
    const u = new URL(normalized);
    return { origin: u.origin, hostname: u.hostname, href: u.href };
  } catch (_) {
    return null;
  }
}

function extractHostname(urlStr) {
  try {
    const normalized = /^https?:\/\//i.test(urlStr) ? urlStr : 'https://' + urlStr;
    return new URL(normalized).hostname;
  } catch (_) {
    return null;
  }
}

function makeTimeoutSignal(ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

async function fetchAsBase64(url) {
  const { signal, clear } = makeTimeoutSignal();
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    });
    clear();
    if (!resp.ok) return null;
    const ctype = (resp.headers.get('content-type') || 'image/png').split(';')[0].trim();
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.byteLength === 0) return null;
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    const cleanType = ctype === 'application/octet-stream' ? 'image/x-icon' : ctype;
    return `data:${cleanType};base64,${btoa(bin)}`;
  } catch (_) {
    clear();
    return null;
  }
}

async function fetchText(url) {
  const { signal, clear } = makeTimeoutSignal();
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    clear();
    if (!resp.ok) return null;
    // 避免内容过大，只取前 512KB 用于解析 link 标签
    const text = await resp.text();
    return text.length > 512 * 1024 ? text.slice(0, 512 * 1024) : text;
  } catch (_) {
    clear();
    return null;
  }
}

function resolveIconHref(html, origin) {
  if (!html) return null;
  const patterns = [
    /<link\s+rel=["'](?:shortcut\s+icon|icon)["'][^>]*href=["']([^"']+)["']/i,
    /<link\s+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+icon|icon)["']/i,
    /<link\s+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
    /<link\s+rel=["']icon["'][^>]+href=["']([^"']+)["']/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      let href = m[1].trim();
      if (!href) continue;
      if (/^https?:\/\//i.test(href)) return href;
      if (href.startsWith('//')) return 'https:' + href;
      try { return new URL(href, origin).href; } catch (_) { /* ignore */ }
    }
  }
  return null;
}

// ============================================================
// 主入口
// ============================================================

export async function onRequest(context) {
  const { request } = context;
  const reqUrl = new URL(request.url);
  const urlParam = reqUrl.searchParams.get('url') || '';

  // ----- CORS 头 -----
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
    });

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // ----- 参数校验 -----
  if (!urlParam) {
    return json(
      { success: false, error: '缺少 url 参数，示例：/api/favicon?url=https://github.com' },
      400
    );
  }

  const parsed = getTargetOrigin(urlParam);
  if (!parsed) {
    return json({ success: false, error: '无法解析 url 的域名' }, 400);
  }
  const { origin, hostname, href } = parsed;

  // ===== 候选 1：直接访问目标网站根路径 /favicon.ico =====
  let b64 = await fetchAsBase64(`${origin}/favicon.ico`);

  // ===== 候选 2：抓取目标网站 HTML，解析 <link rel="icon"> 自定义 URL =====
  if (!b64) {
    const html = await fetchText(href);
    const iconHref = resolveIconHref(html, origin);
    if (iconHref) b64 = await fetchAsBase64(iconHref);
  }

  // ===== 候选 3：www / https / http 变体 =====
  if (!b64) b64 = await fetchAsBase64(`https://www.${hostname}/favicon.ico`);
  if (!b64) b64 = await fetchAsBase64(`https://${hostname}/favicon.ico`);
  if (!b64) b64 = await fetchAsBase64(`http://${hostname}/favicon.ico`);

  // ===== 候选 4：公共 favicon 代理兜底 =====
  if (!b64) b64 = await fetchAsBase64(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`);
  if (!b64) b64 = await fetchAsBase64(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);

  if (!b64) {
    return json(
      { success: false, error: `未找到 ${hostname} 的图标，已尝试 7 个来源均失败` },
      404
    );
  }

  return json({ success: true, hostname, base64: b64, size: b64.length });
}
