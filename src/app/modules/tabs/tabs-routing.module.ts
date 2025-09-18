import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { TabsPage } from "./tabs.page";

const routes: Routes = [
  {
    path: "tabs",
    component: TabsPage,
    children: [
      {
        path: "home",
        loadComponent: () => import("./home/home.page").then((m) => m.HomePage),
        data: {
          index: 0,
        },
      },
      {
        path: "packs",
        loadComponent: () => import("./packs-list/packs-list.page").then((m) => m.PacksListPage),
        data: {
          index: 1,
        },
      },
      {
        path: "account",
        loadComponent: () => import("./account/account.page").then((m) => m.AccountPage),
        data: {
          index: 3,
        },
      },
      {
        path: "",
        redirectTo: "/tabs/home",
        pathMatch: "full",
      },
    ],
  },
  {
    path: "",
    redirectTo: "/tabs/home",
    pathMatch: "full",
  },
  {
    path: "home",
    loadComponent: () => import("./home/home.page").then((m) => m.HomePage),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
