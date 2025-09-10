import { Component, Input, TemplateRef, ViewContainerRef } from '@angular/core';

@Component({
  selector: 'app-modal-template',
  templateUrl: './modal-template.component.html',
  styleUrls: ['./modal-template.component.scss'],
  standalone: false
})
export class ModalTemplateComponent {
  @Input() template!: TemplateRef<any>;
  @Input() dataInput: any;

  constructor(private viewContainerRef: ViewContainerRef) { }

  ngOnInit() {
    this.viewContainerRef.createEmbeddedView(this.template, this.dataInput);

  }
}