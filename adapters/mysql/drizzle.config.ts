import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "../../databases/mysql/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    user: process.env.MYSQL_USER ?? "eve",
    password: process.env.MYSQL_PASSWORD ?? "secret",
    database: process.env.MYSQL_DATABASE ?? "eve_insights",
    port: Number(process.env.MYSQL_PORT ?? 3306),
  },
});
