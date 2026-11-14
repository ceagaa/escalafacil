/**
 * Hash de senha — PBKDF2-SHA256 via WebCrypto (nativo no Workers).
 *
 * Nota: o WebCrypto dos Workers rejeita acima de 100.000 iterações
 * (`NotSupportedError`), então usamos o teto suportado.
 *
 * Formato armazenado: `pbkdf2$<iterations>$<salt_b64>$<hash_b64>`
 *
 * Suporta também verificar hashes BCRYPT legados vindos do Supabase
 * (`bcrypt$...`), permitindo login sem exigir reset de senha na migração.
 * Em caso de sucesso com hash legado, o chamador deve re-hashear para PBKDF2.
 */

const PBKDF2_ITERATIONS = 100_000; // máximo suportado pelo WebCrypto dos Workers
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Deriva PBKDF2-SHA256 com timing seguro. */
async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Cria um novo hash PBKDF2. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verifica a senha contra o hash armazenado.
 * Retorna `{ ok, needsRehash }` — `needsRehash=true` quando o hash é legado
 * (bcrypt do Supabase) e deve ser atualizado para PBKDF2 após o login.
 */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith("pbkdf2$")) {
    const [, iterStr, saltB64, hashB64] = stored.split("$");
    const iterations = Number(iterStr);
    if (!iterations || !saltB64 || !hashB64) return { ok: false, needsRehash: false };
    const expected = fromBase64(hashB64);
    const actual = await derive(password, fromBase64(saltB64), iterations);
    return { ok: timingSafeEqual(actual, expected), needsRehash: false };
  }

  if (stored.startsWith("bcrypt$")) {
    // Hash legado do Supabase ($2a$...). O hash-wasm só gera hashes — a
    // comparação é feita decodificando o salt e re-gerando o hash.
    const raw = stored.slice("bcrypt$".length);
    const match = /^\$2[aby]\$(\d\d)\$([./A-Za-z0-9]{53})$/.exec(raw);
    if (!match) return { ok: false, needsRehash: false };
    try {
      const { bcrypt } = await import("hash-wasm");
      const cost = parseInt(match[1], 10);
      const salt = decodeBcryptBase64(match[2].slice(0, 22));
      const actual = await bcrypt({ password, salt, costFactor: cost, outputType: "encoded" });
      // hash-wasm normaliza o prefixo ($2a$) — comparamos só a parte após o custo.
      const ok = actual.slice(7) === raw.slice(7);
      return { ok, needsRehash: ok };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }

  return { ok: false, needsRehash: false };
}

/** Alfabeto base64 do bcrypt ("./A-Za-z0-9") — 22 chars codificam 16 bytes. */
const BCRYPT_B64 = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function decodeBcryptBase64(value: string): Uint8Array {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of value) {
    const idx = BCRYPT_B64.indexOf(ch);
    if (idx < 0) throw new Error("bcrypt base64 inválido");
    buf = (buf << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
