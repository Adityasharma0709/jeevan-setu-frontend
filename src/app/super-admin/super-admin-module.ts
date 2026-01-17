import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SuperAdminRoutingModule } from './super-admin-routing-module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    SuperAdminRoutingModule,
    ReactiveFormsModule, // ✅ ADD
    FormsModule, // ✅ ADD (for ngModel)
  ],
})
export class SuperAdminModule {}
