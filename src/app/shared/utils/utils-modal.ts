import { Injectable, TemplateRef } from '@angular/core';
import {
  AnimationController,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { Utils } from './utils';

@Injectable({
  providedIn: 'root',
})
export class UtilsModal {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();
  private currentToast: any = null;

  constructor(
    private utils: Utils,
    private modalCtrl: ModalController,
    private animationCtrl: AnimationController,
    private toastController: ToastController
  ) {}

  async openDialog(
    component: any,
    header: string,
    content: string,
    btns: any
  ): Promise<boolean> {
    const modal = await this.modalCtrl.create({
      component: component,
      id: 'custom-dialog',
      enterAnimation: this.enterAnimation,
      leaveAnimation: this.leaveAnimation,
      componentProps: {
        header: header,
        content: content,
        btns: btns,
      },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data ? true : false;
  }

  async openModalSheet(component: any) {
    const modal = await this.modalCtrl.create({
      component: component,
      id: 'custom-dialog',
      initialBreakpoint: 1,
      breakpoints: [0, 1],
    });
  }

  enterAnimation = (baseEl: HTMLElement) => {
    const root = baseEl.shadowRoot;

    const backdropAnimation = this.animationCtrl
      .create()
      .addElement(root!.querySelector('ion-backdrop')!)
      .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = this.animationCtrl
      .create()
      .addElement(root!.querySelector('.modal-wrapper')!)
      .keyframes([
        { offset: 0, opacity: '0', transform: 'scale(0)' },
        { offset: 1, opacity: '0.99', transform: 'scale(1)' },
      ]);

    return this.animationCtrl
      .create()
      .addElement(baseEl)
      .easing('ease-out')
      .duration(200)
      .addAnimation([backdropAnimation, wrapperAnimation]);
  };

  leaveAnimation = (baseEl: HTMLElement) => {
    return this.enterAnimation(baseEl).direction('reverse');
  };

  async presentToast(
    message: string = '',
    color: string,
    position: 'top' | 'middle' | 'bottom' = 'bottom'
  ) {
    if (this.currentToast) {
      await this.currentToast.dismiss();
      this.currentToast = null;
    }

    this.currentToast = await this.toastController.create({
      message: message,
      duration: 1500,
      position: position,
      cssClass: 'cus-toast-msg',
      color: color,
    });

    await this.currentToast.present();
  }

  async openContextModal(
    component: any,
    dataInput: any,
    event: any,
    id: string
  ) {
    const parentElement = (event.currentTarget as HTMLElement).closest(id);
    if (!parentElement) return;

    const rect = parentElement.getBoundingClientRect();

    const modal = await this.modalCtrl.create({
      component: component, // Thay bằng component của bạn
      cssClass: 'custom-context-modal',
      componentProps: dataInput,
    });

    // Thời gian chờ ngắn để đảm bảo modal đã được thêm vào DOM
    const modalWrapperElement = document
      .querySelector('ion-modal')
      ?.shadowRoot?.querySelector('.modal-wrapper') as HTMLElement;
    if (modalWrapperElement) {
      modalWrapperElement.style.top = `${rect.top}px`;
      modalWrapperElement.style.left = `${rect.left}px`;
      modalWrapperElement.style.position = 'absolute';

      // Sau khi thiết lập vị trí, hiển thị modal
    }

    await modal.present();

    const { data } = await modal.onDidDismiss();
    return data;
  }

  async openTemplateModal(
    template: TemplateRef<any>,
    event: any,
    id: string,
    position?: string
  ) {}

  async presentCusToast(
    msg: string = '',
    icon: string = 'assets/imgs/logo.png',
    style: string = 'danger',
    position: 'top' | 'middle' | 'bottom' = 'bottom'
  ) {}
}
