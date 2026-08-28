declare module 'better-sqlite3' {
  export interface Database {
    prepare(sql: string): Statement;
    close(): void;
  }
  
  export interface Statement {
    all(params?: any[]): any[];
    get(params?: any[]): any;
    run(params?: any[]): { changes: number };
    changes: number;
  }
  
  function Database(filename: string, options?: { verbose?: any }): Database;
  export = Database;
}
