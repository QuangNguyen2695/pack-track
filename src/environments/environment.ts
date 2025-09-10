import { Environment } from "./environment.model";

export class environment extends Environment {
  public override production: boolean = false;
}

export const ENV: Environment = new environment();
