import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connection = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) ?? 3306,
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "nest_shield_dashboard",
  connectionLimit: Number(process.env.MAX_CONNECTIONS) ?? 10,
  connectTimeout: 60000,
});

export const db = drizzle(connection, { schema, mode: "default" });

export type DB = typeof db;
export * from "./schema";
