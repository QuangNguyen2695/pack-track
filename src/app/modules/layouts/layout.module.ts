import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


import { NZModule } from '@rsApp/library-modules/nz-module';
import { LayoutComponent } from './layout.component';
import { LayoutRoutingModule } from './layout-routing.module';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './component/footer/footer.component';
import { HeaderComponent } from './component/header/header.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
@NgModule({
    imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        LayoutRoutingModule,
        NZModule,
        RouterOutlet,
        ScrollingModule
    ],
    declarations: [LayoutComponent, FooterComponent, HeaderComponent],
    exports: [LayoutComponent]
})
export class LayoutModule { }
