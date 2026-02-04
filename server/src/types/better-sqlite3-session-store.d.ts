declare module "better-sqlite3-session-store" {
  import session from "express-session";

  interface ExpiredOptions {
    clear?: boolean;
    intervalMs?: number;
  }

  interface SqliteStoreOptions {
    client: {
      prepare(sql: string): {
        run(params?: any): any;
        get(params?: any): any;
        all(params?: any): any;
      };
      exec(sql: string): void;
    };
    expired?: ExpiredOptions;
  }

  function createSqliteStore(session: typeof import("express-session")): {
    new (options: SqliteStoreOptions): session.Store;
  };

  export = createSqliteStore;
}
