import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyOtpPage } from './verify-otp.page';

describe('VerifyOtpPage', () => {
  let component: VerifyOtpPage;
  let fixture: ComponentFixture<VerifyOtpPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerifyOtpPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
