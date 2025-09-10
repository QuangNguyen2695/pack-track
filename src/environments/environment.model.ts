export abstract class Environment {
  // public apiUrl: string = 'http://localhost:8080';
  public apiUrl: string = 'http://192.168.1.164:8080';
  public production: boolean = false;
  public isWebApp: boolean = false;
  public firebase: any;
}
