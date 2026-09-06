const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-real-ip",
]);

function buildTargetUrl(request, params, supabaseUrl) {
  const incoming = new URL(request.url);
  const splat = params.path;
  const rest = Array.isArray(splat) ? splat.join("/") : splat || "";
  if (rest.includes("..") || /^https?:/i.test(rest)) {
    return null;
  }
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/${rest}${incoming.search}`;
}

function proxyHeaders(request, anonKey) {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("apikey", anonKey);
  if (!request.headers.get("Authorization")) {
    headers.set("Authorization", `Bearer ${anonKey}`);
  }
  return headers;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return new Response("Supabase proxy is not configured.", { status: 500 });
  }

  const target = buildTargetUrl(request, params, supabaseUrl);
  if (!target) {
    return new Response("Invalid path.", { status: 400 });
  }

  const init = {
    method: request.method,
    headers: proxyHeaders(request, anonKey),
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstream = await fetch(target, init);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
