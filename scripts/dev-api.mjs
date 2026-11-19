#!/usr/bin/env node
/**
 * Sobe a API do EscalaFácil (`wrangler dev`) na mesma porta que o proxy do
 * Vite usa — e falha com mensagem clara se essa porta estiver ocupada por
 * OUTRO projeto.
 *
 * Por que existe: quando a porta padrão está ocupada, o `wrangler dev` cai
 * silenciosamente para a próxima (8788, 8789...) enquanto o proxy do Vite
 * continua apontando para 8787. O frontend passa a falar com o backend
 * errado e exibe erros incompreensíveis (404/405 sem corpo viram
 * "Ocorreu um erro inesperado." no cadastro, por exemplo).
 *
 * Porta: `VITE_API_PORT` (variável de ambiente ou `.env`), padrão 8787.
 * Este script e o `vite.config.ts` leem o mesmo valor, então wrangler e
 * proxy sempre andam juntos.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { request } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 8787;
const WRANGLER_ENTRY = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

/** Termina com mensagem de erro (usado antes de o servidor subir). */
function fail(message) {
  console.error(`\n\x1b[31m❌ ${message}\x1b[0m\n`);
  process.exit(1);
}

/** Lê uma variável simples do `.env` (sem dependência externa). */
function readDotEnv(key) {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && match[1] === key) return match[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/** Porta da API: ambiente > `.env` > padrão. */
function resolvePort() {
  const raw = process.env.VITE_API_PORT ?? readDotEnv("VITE_API_PORT");
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`VITE_API_PORT inválido: "${raw}". Use um número de porta válido (ex.: 8787 ou 8790).`);
  }
  return port;
}

/** GET /api/health — devolve `{ status, body }` ou `{ error }` se não responder. */
function probeHealth(port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = request(
      { host: "127.0.0.1", port, path: "/api/health", method: "GET", timeout: timeoutMs },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err) => resolve({ error: err.code || err.message }));
    req.end();
  });
}

/** A resposta veio da API do EscalaFácil? (`{"ok":true,"db":"d1"}`) */
function isEscalaFacilApi(body) {
  try {
    const data = JSON.parse(body);
    return data?.ok === true && data?.db === "d1";
  } catch {
    return false;
  }
}

function portHint(port) {
  return [
    "Como resolver (escolha um):",
    `  1) Pare o serviço que ocupa a porta ${port} e rode "npm run dev" de novo.`,
    "     Windows : Get-NetTCPConnection -LocalPort " + port + " -State Listen | Select OwningProcess",
    "               taskkill /PID <pid> /F",
    "     Linux   : lsof -i :" + port,
    `  2) Ou use outra porta: adicione VITE_API_PORT=${port === DEFAULT_PORT ? 8790 : DEFAULT_PORT} no .env`,
    '     e rode "npm run dev" de novo — wrangler e proxy do Vite passam a',
    "     usar a mesma porta automaticamente.",
  ].join("\n");
}

async function main() {
  const port = resolvePort();
  const probe = await probeHealth(port);

  // Conexão recusada = porta livre, é só subir.
  const free = probe.error === "ECONNREFUSED" || probe.error === "EHOSTUNREACH";
  if (!free) {
    const ours = probe.status !== undefined && isEscalaFacilApi(probe.body);
    if (ours) {
      fail(
        `Já existe uma instância do EscalaFácil rodando na porta ${port}.\n` +
          "Feche a instância anterior (Ctrl+C na outra janela) antes de iniciar uma nova."
      );
    }
    const detalhe = probe.status
      ? `HTTP ${probe.status}${probe.body ? ` — corpo: ${probe.body.slice(0, 120)}` : " — corpo vazio"}`
      : `não respondeu HTTP (${probe.error})`;
    fail(
      `A porta ${port} está ocupada por outro projeto/serviço (não é a API do EscalaFácil).\n` +
        `  Resposta recebida: ${detalhe}\n\n` +
        "Com a porta errada, o proxy do Vite fala com o backend de outro app e o\n" +
        'EscalaFácil falha (ex.: "Ocorreu um erro inesperado." ao criar conta).\n\n' +
        portHint(port)
    );
  }

  if (!existsSync(WRANGLER_ENTRY)) {
    fail('wrangler não encontrado em node_modules. Rode "npm install" primeiro.');
  }

  console.log(`\x1b[34m[api]\x1b[0m Subindo o Worker local em http://localhost:${port} ...`);
  const child = spawn(process.execPath, [WRANGLER_ENTRY, "dev", "--port", String(port)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, VITE_API_PORT: String(port) },
  });

  const forward = (signal) => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));

  child.on("error", (err) => fail(`Não foi possível iniciar o wrangler: ${err.message}`));
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

await main();
