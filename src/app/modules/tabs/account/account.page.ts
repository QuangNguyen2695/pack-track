import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AuthAccessService } from "@rsApp/shared/services/auth-access-service/auth-access.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";

@Component({
  selector: "app-account",
  templateUrl: "./account.page.html",
  styleUrls: ["./account.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule],
})
export class AccountPage implements OnInit {
  currentUser: any;
  componentElement: HTMLElement;

  constructor(
    private credentialService: CredentialService,
    private router: Router,
    private authAccessService: AuthAccessService,
    private nativeComponent: ElementRef,
  ) {
    this.componentElement = this.nativeComponent.nativeElement;
  }

  ngOnInit() {
    this.initializeData();
  }

  async initializeData() {
    const currentUser = await this.credentialService.getCurrentUser();
    if (!currentUser) {
      this.router.navigateByUrl(`/auth-access`);
    }
    this.currentUser = currentUser;
  }

  goToDetailAccount() {
    this.router.navigateByUrl("/account-detail");
  }

  async logout() {
    this.credentialService.setUserResidual({
      phoneNumber: this.currentUser.phoneNumber,
      name: this.currentUser.name,
    });
    await this.authAccessService.logout();
    this.router.navigateByUrl(`/auth-access`);
  }
}
