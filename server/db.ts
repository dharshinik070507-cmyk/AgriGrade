import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: any = null;

if (!process.env.DATABASE_URL) {
  console.log("⚠ DATABASE_URL not found — running in PROTOTYPE MODE (no database)");
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { pool, db };
