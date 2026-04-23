import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { AppModule } from "./app/app.module";
import { enableProdMode } from "@angular/core";
import { ENV } from "./environments/environment.development";

if (ENV.production) {
  enableProdMode();
  //show this warning only on prod mode
  if (window) {
    selfXSSWarning();
  }
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(() => {});

function selfXSSWarning() {
  setTimeout(() => {
          });
}
