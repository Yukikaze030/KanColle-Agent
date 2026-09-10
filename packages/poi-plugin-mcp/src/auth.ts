import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export interface TokenFile {
  token: string;
  created_at: string;
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function loadOrCreateToken(filePath: string): TokenFile {
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as TokenFile;
    } catch {
      // regenerate on corrupt
    }
  }
  const token = generateToken();
  const data: TokenFile = { token, created_at: new Date().toISOString() };
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1] ?? null;
}

export function isAuthorized(
  authHeader: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return true; // token disabled in tests
  const got = extractBearer(authHeader);
  return got === expectedToken;
}

export function defaultTokenPath(): string {
  return join(process.cwd(), "packages", "poi-plugin-mcp", "token.json");
}
