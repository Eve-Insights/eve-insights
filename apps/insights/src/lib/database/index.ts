import {
  type DatabaseAdapter,
  DatabaseKind,
} from "@eve-insights/adapter-types";
import { databaseEnvSchema } from "@/environment/database";

const adapters = {
  [DatabaseKind.FIRESTORE]: () => import("@eve-insights/adapter-firestore"),
  [DatabaseKind.MYSQL]: () => import("@eve-insights/adapter-mysql"),
  [DatabaseKind.SQLITE]: () => import("@eve-insights/adapter-sqlite"),
  [DatabaseKind.SUPABASE]: () => import("@eve-insights/adapter-supabase"),
} as const;

let cached: Promise<DatabaseAdapter> | undefined;

export async function getDatabase(): Promise<DatabaseAdapter> {
  cached ??= createDatabase();
  return cached;
}

export function clearDatabaseCache(): void {
  cached = undefined;
}

async function createDatabase(): Promise<DatabaseAdapter> {
  const env = databaseEnvSchema.parse(process.env);

  switch (env.EVE_INSIGHTS_DATABASE) {
    case DatabaseKind.FIRESTORE: {
      const { FirestoreAdapter } = await adapters[DatabaseKind.FIRESTORE]();
      return new FirestoreAdapter({
        projectId: env.FIREBASE_PROJECT_ID,
      });
    }
    case DatabaseKind.MYSQL: {
      const { MysqlAdapter } = await adapters[DatabaseKind.MYSQL]();
      return new MysqlAdapter({
        host: env.MYSQL_HOST,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE,
        port: env.MYSQL_PORT,
      });
    }
    case DatabaseKind.SQLITE: {
      const { SqliteAdapter } = await adapters[DatabaseKind.SQLITE]();
      return new SqliteAdapter({
        path: env.SQLITE_PATH,
      });
    }
    case DatabaseKind.SUPABASE: {
      const { SupabaseAdapter } = await adapters[DatabaseKind.SUPABASE]();
      return new SupabaseAdapter({
        url: env.SUPABASE_URL,
        secretKey: env.SUPABASE_SECRET_KEY,
      });
    }
    case DatabaseKind.POSTGRES:
      throw new Error(
        `The '${env.EVE_INSIGHTS_DATABASE}' Eve Insights database adapter is not implemented yet.`,
      );
  }
}
