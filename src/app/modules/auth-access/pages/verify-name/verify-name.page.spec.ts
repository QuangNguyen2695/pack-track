import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerifyNamePage } from './verify-name.page';

describe('VerifyNamePage', () => {
  let component: VerifyNamePage;
  let fixture: ComponentFixture<VerifyNamePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerifyNamePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
