declare module 'sqlite3' {
  export class Database {
    constructor(filename: string, callback?: (err: any) => void);
    run(sql: string, callback?: (err: any) => void): void;
    all(sql: string, callback?: (err: any, rows: any[]) => void): void;
    get(sql: string, callback?: (err: any, row: any) => void): void;
    close(callback?: () => void): void;
  }
}
