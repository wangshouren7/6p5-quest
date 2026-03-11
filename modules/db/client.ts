import { PrismaClient } from "@/modules/db/generated/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const tursoUrl = process.env["TURSO_DATABASE_URL"]?.trim();
const tursoToken = process.env["TURSO_AUTH_TOKEN"];

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1000];

function getMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e != null && "message" in e)
    return String((e as { message: unknown }).message);
  return "";
}

function getCauseMessage(e: unknown): string {
  if (e instanceof Error && e.cause != null) return getMessage(e.cause);
  if (typeof e === "object" && e != null && "cause" in e)
    return getMessage((e as { cause: unknown }).cause);
  return "";
}

/** 是否为可重试的瞬时错误（网络/连接/事务关闭） */
function isRetryableError(e: unknown): boolean {
  const msg = getMessage(e).toLowerCase();
  const causeMsg = getCauseMessage(e).toLowerCase();
  const combined = `${msg} ${causeMsg}`;
  if (
    combined.includes("socket hang up") ||
    combined.includes("econnreset") ||
    combined.includes("etimedout") ||
    combined.includes("network")
  )
    return true;
  const name =
    (e as { name?: string })?.name ?? (e as object)?.constructor?.name ?? "";
  if (name === "DriverAdapterError") return true;
  const code = (e as { code?: string })?.code;
  if (code === "P2028") return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delaysMs: number[] },
): Promise<T> {
  const { maxAttempts, delaysMs } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt === maxAttempts || !isRetryableError(e)) throw e;
      const delay =
        delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 500;
      await sleep(delay);
    }
  }
  throw lastError;
}

function createDb() {
  if (!tursoUrl) {
    throw new Error(
      "未配置 Turso 数据库。请在 .env 中设置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN。",
    );
  }
  const adapter = new PrismaLibSql({
    url: tursoUrl,
    authToken: tursoToken ?? "",
  });
  const base = new PrismaClient({ adapter });
  return base.$extends({
    name: "retry",
    query: {
      $allModels: {
        $allOperations({ args, query }) {
          return withRetry(() => query(args), {
            maxAttempts: RETRY_MAX_ATTEMPTS,
            delaysMs: RETRY_DELAYS_MS,
          });
        },
      },
    },
  });
}

export type DbClient = ReturnType<typeof createDb>;

const globalForPrisma = globalThis as unknown as { db: DbClient };

export const db = globalForPrisma.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.db = db;
}
