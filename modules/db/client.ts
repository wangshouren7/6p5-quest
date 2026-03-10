import { PrismaClient } from "@/modules/db/generated/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const tursoUrl = process.env["TURSO_DATABASE_URL"]?.trim();
const tursoToken = process.env["TURSO_AUTH_TOKEN"];

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
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { db: PrismaClient };

export const db = globalForPrisma.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.db = db;
}
