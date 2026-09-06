import { createClient } from "@supabase/supabase-js";

const PROXY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImVzY2FsYWZhY2lsLXByb3h5IiwiaWF0IjoxLCJleHAiOjQwOTI1NDIwMDB9.placeholder";

function getProxyUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/sb`;
  }
  return "http://127.0.0.1:5173/sb";
}

export const supabase = createClient(getProxyUrl(), PROXY_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
