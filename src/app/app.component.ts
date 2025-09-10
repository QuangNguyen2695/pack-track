import { Component, HostListener, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Router } from '@angular/router';
import { AuthAccessService } from './shared/services/auth-access-service/auth-access.service';
import { CredentialService } from './shared/services/credential-service/credential.service';
import { Utils } from './shared/utils/utils';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  currentUser: any;

  constructor(
    private platform: Platform,
    public utils: Utils,
    private authAccessService: AuthAccessService,
    private credentialService: CredentialService,
    private router: Router
  ) {
    this.initializeApp();
  }

  ngOnInit() {
    this.checkScreenSize();
  }

  async initializeApp() {
    const currentUser = await this.credentialService.getCurrentUser();
    this.currentUser = currentUser;
    if (this.platform.is('cordova') || this.platform.is('capacitor')) {
      console.log('Chạy trên thiết bị di động');
      // Làm cho thanh status bar trong suốt
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: Style.Default });
      StatusBar.setBackgroundColor({ color: '#00000000' });
    } else {
      console.log('Chạy trên trình duyệt');
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.utils.isApp = window.innerWidth < 1128;
    this.setScrollbarCss();
  }

  setScrollbarCss() {
    const styleId = 'dynamic-scrollbar-style'; // Unique ID for the style element

    if (!this.utils.isApp) {
      // Add styles dynamically
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
                /* width */
                ::-webkit-scrollbar {
                    width: 6px;
                    height: 4px;
                }
    
                /* Track */
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
    
                /* Handle */
                ::-webkit-scrollbar-thumb {
                    background: #888;
                }
    
                /* Handle on hover */
                ::-webkit-scrollbar-thumb:hover {
                    background: var(--primary);
                }
    
                .menu-selected {
                    border-bottom: 2px solid white;
                }
    
                .content-body {
                    .ion-page {
                        display: contents;
                    }
                }
            `;
        document.head.appendChild(style);
      }
    } else {
      // Remove dynamically added styles
      const style = document.getElementById(styleId);
      if (style) {
        style.remove(); // Removes the style element from the document
      }
    }
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
