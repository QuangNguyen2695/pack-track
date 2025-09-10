import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyPhoneNumberPage } from './verify-phone-number.page';

describe('VerifyPhoneNumberPage', () => {
  let component: VerifyPhoneNumberPage;
  let fixture: ComponentFixture<VerifyPhoneNumberPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerifyPhoneNumberPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
