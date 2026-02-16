declare module "better-sqlite3-session-store" {
  import type ExpressSession from "express-session";
  import type { Store } from "express-session";

  interface ExpiredOptions {
    clear?: boolean;
    intervalMs?: number;
  }

  interface SqliteStoreOptions {
    client: {
      prepare(sql: string): {
        run(params?: unknown): unknown;
        get(params?: unknown): unknown;
        all(params?: unknown): unknown;
      };
      exec(sql: string): void;
    };
    expired?: ExpiredOptions;
  }

  type SqliteStoreConstructor = new (options: SqliteStoreOptions) => Store;

  type CreateSqliteStore = (
    session: typeof ExpressSession
  ) => SqliteStoreConstructor;

  const createSqliteStore: CreateSqliteStore;

  export = createSqliteStore;
}
