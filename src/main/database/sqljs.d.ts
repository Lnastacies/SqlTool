declare module 'sql.js' {
  interface Database {
    exec(sql: string): Array<{ columns: string[]; values: any[][] }>;
    close(): void;
  }

  interface SQL {
    Database: typeof Database;
  }

  function initSqlJs(options?: { locateFile?: (file: string) => string }): Promise<SQL>;
  export default initSqlJs;
}
