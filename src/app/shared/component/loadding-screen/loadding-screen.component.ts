import { Component, Input } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import {
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  Router,
} from '@angular/router';
import { tap } from 'rxjs';
import { LoadingService } from '@rsApp/shared/services/loadding-service/loading.service';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-loadding-screen',
  templateUrl: './loadding-screen.component.html',
  styleUrl: './loadding-screen.component.scss',
  imports: [CommonModule, FormsModule, IonicModule],
})
export class LoaddingScreenComponent {
  @Input()
  detectRouteTransitions = false;

  loading$: boolean = false;

  constructor(public loadingService: LoadingService, private router: Router) {
    this.loadingService.loading$.subscribe((res: any) => {
      this.loading$ = res;
    });
  }

  ngOnInit() {
    if (this.detectRouteTransitions) {
      this.router.events
        .pipe(
          tap((event: any) => {
            if (event instanceof RouteConfigLoadStart) {
              this.loadingService.loadingOn();
            } else if (event instanceof RouteConfigLoadEnd) {
              this.loadingService.loadingOff();
            }
          })
        )
        .subscribe();
    }
  }
}
