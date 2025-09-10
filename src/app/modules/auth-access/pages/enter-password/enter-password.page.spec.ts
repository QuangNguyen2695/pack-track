import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnterPasswordPage } from './enter-password.page';

describe('EnterPasswordPage', () => {
  let component: EnterPasswordPage;
  let fixture: ComponentFixture<EnterPasswordPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EnterPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
