declare module 'tedious' {
  export class Connection {
    constructor(config: any);
    connect(callback?: (err: any) => void): void;
    close(callback?: (err: any) => void): void;
    on(event: string, listener: (...args: any[]) => void): this;
    execSql(request: Request): void;
    cancel(): boolean;
    beginTransaction(
      callback: (error?: Error) => void,
      name?: string,
      isolationLevel?: number,
    ): void;
    commitTransaction(
      callback: (error?: Error) => void,
      name?: string,
    ): void;
    rollbackTransaction(
      callback: (error?: Error) => void,
      name?: string,
    ): void;
  }
  export class Request {
    constructor(sql: string, callback?: (err: any, rowCount: any) => void);
    on(event: string, listener: (...args: any[]) => void): this;
    addParameter(name: string, type: any, value: any): void;
    cancel(): void;
  }
  export const TYPES: any;
  export const ISOLATION_LEVEL: any;
}

declare module 'tedious/lib/request' {
  export class Request {
    constructor(sql: string, callback?: (err: any, rowCount: any) => void);
    on(event: string, listener: (...args: any[]) => void): this;
  }
}
