import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { AdmobService } from '../../services/admob-service/dmob.service';

@Component({
  selector: 'app-native-ad-display',
  templateUrl: './native-ad-display.component.html',
  styleUrls: ['./native-ad-display.component.scss'],
  imports: [CommonModule, SlicePipe],
})
export class NativeAdDisplayComponent implements OnInit, OnDestroy {
  nativeAdData: any = null;
  isLoading = false;
  hasError = false;

  constructor(private adsService: AdmobService) {}

  ngOnInit() {
    this.loadNativeAd();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  loadNativeAd() {
    this.isLoading = true;
    this.hasError = true; // Default: disabled, pending capacitor-admob-ads setup

    // TODO: Enable when capacitor-admob-ads native ads are fully implemented
    // this.adsService
    //   .loadNativeAdData()
    //   .then((adData) => {
    //     if (adData) {
    //       this.nativeAdData = adData;
    //       this.hasError = false;
    //     } else {
    //       this.hasError = true;
    //     }
    //   })
    //   .catch((error) => {
    //     console.error('Error loading native ad:', error);
    //     this.hasError = true;
    //   })
    //   .finally(() => {
    //     this.isLoading = false;
    //   });

    this.isLoading = false;
  }

  onAdClick() {
    console.log('Native ad clicked');
    // Track click if needed
  }
}
