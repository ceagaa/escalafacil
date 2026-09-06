export async function onRequest(context) {
  const { env } = context;
  return Response.json({
    hasUrl: !!env.SUPABASE_URL,
    hasKey: !!env.SUPABASE_ANON_KEY,
    urlPrefix: env.SUPABASE_URL ? env.SUPABASE_URL.substring(0, 30) : null,
    keyPrefix: env.SUPABASE_ANON_KEY ? env.SUPABASE_ANON_KEY.substring(0, 15) : null,
    envKeys: Object.keys(env || {}),
  });
}
