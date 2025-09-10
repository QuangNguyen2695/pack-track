import { Component, OnInit, ViewChild } from '@angular/core';
import { Event, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Utils } from '@rsApp/shared/utils/utils';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: false,
})
export class HeaderComponent implements OnInit {

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
