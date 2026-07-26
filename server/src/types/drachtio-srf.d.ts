declare module 'drachtio-srf' {
  export default class Srf {
    constructor();
    connect(config: any): Promise<void>;
    disconnect(): void;
    createUAC(uri: string, opts: any): Promise<any>;
    request(uri: string, opts: any): Promise<any>;
    on(event: string, callback: (...args: any[]) => void): void;
  }
}
