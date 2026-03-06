import { PrismaClient } from "@/modules/db/generated/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const dbUrl = process.env["DATABASE_URL"]?.startsWith("file:")
  ? process.env["DATABASE_URL"]
  : `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

function createDb() {
  try {
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    return new PrismaClient({ adapter });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("bindings") || msg.includes("better_sqlite3")) {
      throw new Error(
        "better-sqlite3 原生模块未正确编译。请先安装编译环境：\n" +
          "  macOS: 在终端执行 xcode-select --install\n" +
          "  Windows: 安装 windows-build-tools (npm i -g windows-build-tools)\n" +
          "然后在本项目根目录执行: pnpm run db:rebuild",
        { cause: err },
      );
    }
    throw err;
  }
}

const globalForPrisma = globalThis as unknown as { db: PrismaClient };

export const db = globalForPrisma.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.db = db;
}
