import { Component, ViewChild } from "@angular/core";
import { Router } from "@angular/router";
import { IonRouterOutlet, IonTabs, NavController } from "@ionic/angular";
import { PreviousRouteService } from "@rsApp/shared/services/previous-route-service/previous-route.service";
import { Utils } from "@rsApp/shared/utils/utils";

@Component({
  selector: "app-tabs",
  templateUrl: "tabs.page.html",
  styleUrls: ["tabs.page.scss"],
  standalone: false,
})
export class TabsPage {
  @ViewChild("tabs", { static: true }) tabs: IonTabs | undefined;
  routerOutletTabs: IonRouterOutlet | undefined;

  last_component: HTMLElement | undefined;
  last_component_index: number | undefined;
  current_tab: string = "home";

  constructor(
    private navController: NavController,
    private router: Router,
    private previousRouteService: PreviousRouteService,
    public utils: Utils,
  ) {}

  ngAfterViewInit(): void {
    this.routerOutletTabs = this.tabs && this.tabs.outlet;

    this.routerOutletTabs &&
      this.routerOutletTabs.activateEvents.subscribe((e: any) => {
        const prevUrl = this.previousRouteService.getPreviousUrl();

        if (!this.last_component) {
          this.last_component = e.componentElement;
          this.last_component_index = this.routerOutletTabs && this.routerOutletTabs.activatedRouteData["index"];
          return;
        }

        if (!prevUrl.includes("tabs")) {
          this.last_component.classList.remove("toRight");
          this.last_component.classList.remove("toLeft");

          return;
        }

        const data_router = this.routerOutletTabs && this.routerOutletTabs.activatedRouteData;

        if (this.last_component_index != null && this.last_component_index < data_router?.["index"]) {
          this.last_component && this.last_component.classList.add("toLeft");
          this.last_component && this.last_component.classList.remove("toRight");
          e.componentElement.classList.add("toLeft");
          e.componentElement.classList.remove("toRight");
        } else {
          this.last_component && this.last_component.classList.remove("toLeft");
          this.last_component && this.last_component.classList.add("toRight");
          e.componentElement.classList.remove("toLeft");
          e.componentElement.classList.add("toRight");
        }

        this.last_component = e.componentElement;
        this.last_component_index = data_router?.["index"];
      });
  }

  navigateForward(tab: string) {
    this.navController.setDirection("forward");
    this.router.navigate([tab]);
  }

  goToScan() {
    this.router.navigateByUrl("/scan-record");
  }

  setCurrentTab(event: any) {
    this.current_tab = event.tab;
  }
}
