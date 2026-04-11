import { Environment } from "./environment.model";

export class environment extends Environment {
  public override production: boolean = false;
  public override appName: string = "SafeTrack";
  public override appVersion: string = "1.0.6";
}

export const ENV: Environment = new environment();
