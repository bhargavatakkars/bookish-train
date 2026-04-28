import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __postgres?: ReturnType<typeof postgres>;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const sql =
  globalForDb.__postgres ??
  postgres(connectionString, {
    max: 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__postgres = sql;

export const db = drizzle(sql, { schema });

