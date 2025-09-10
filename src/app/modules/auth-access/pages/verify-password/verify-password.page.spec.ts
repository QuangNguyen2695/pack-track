import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyPasswordPage } from './verify-password.page';

describe('VerifyPasswordPage', () => {
  let component: VerifyPasswordPage;
  let fixture: ComponentFixture<VerifyPasswordPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerifyPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
