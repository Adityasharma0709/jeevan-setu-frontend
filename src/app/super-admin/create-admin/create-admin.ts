import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';

@Component({
  selector: 'app-create-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-admin.html'
})
export class CreateAdminComponent {

  form!: FormGroup;
  admins: any[] = [];

  constructor(
    private fb: FormBuilder,
    private api: ApiService
  ) {
    this.form = this.fb.group({
      name: [''],
      email: [''],
      password: ['']
    });
  }

  ngOnInit() {
    this.loadAdmins();
  }

  loadAdmins() {
    this.api.get('/users/admins')
      .subscribe((res: any) => {
        this.admins = res;
      });
  }

  submit() {
    this.api.post('/users/create-admin', this.form.value)
      .subscribe(() => {
        alert('Admin created');
        this.form.reset();
        this.loadAdmins();
      });
  }
}
