import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";

@Component({
  selector: "app-account",
  templateUrl: "./account.page.html",
  styleUrls: ["./account.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule],
})
export class AccountPage implements OnInit {
  constructor() {}

  ngOnInit() {}
}
