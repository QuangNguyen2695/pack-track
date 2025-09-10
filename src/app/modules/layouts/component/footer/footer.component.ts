import { Component, OnInit, ViewChild } from '@angular/core';
import { Event, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Utils } from '@rsApp/shared/utils/utils';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  standalone: false,
})
export class FooterComponent implements OnInit {

  constructor(
    public utils: Utils,
  ) {

  }

  ngOnInit(): void {
  }

  getSubUrl(): string {
    const path = window.location.pathname;
    const query = window.location.search;
    return path + query;
  }

  isCurrentSubUrlValid(url: string): boolean {
    const currentSubUrl = this.getSubUrl();
    return url.includes(currentSubUrl);

  }
}
