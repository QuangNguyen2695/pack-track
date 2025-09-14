import { ElementRef, Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Location } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { FormGroup } from '@angular/forms';

@Injectable({
  providedIn: 'root',
})
export class Utils {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  isApp = false;

  constructor(private location: Location, private sanitizer: DomSanitizer) {}

  showLoading(timeout?: number) {
    this.loadingSubject.next(true);
    setInterval(() => {
      this.loadingSubject.next(false);
    }, timeout || 5000);
  }

  hideLoading() {
    this.loadingSubject.next(false);
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control: any) => {
      control.markAsTouched();
      control.markAsDirty();
      // control.updateValueAndValidity({ onlySelf: true });
      if (control.controls) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
