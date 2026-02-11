import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { Observable, Subject, startWith, switchMap, of, tap } from 'rxjs';
import { toast } from 'ngx-sonner';

import { AdminService, Session, Activity } from '../admin.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardIconComponent } from '@/shared/components/icon';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardDialogModule,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardIconComponent,
  ],
  templateUrl: './sessions.html',
  styleUrl: './sessions.css',
})
export class Sessions {
  @ViewChild('sessionDialog') sessionDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  sessionForm!: FormGroup;
  activityControl = new FormControl('');

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedSessionId: number | null = null;

  activities$: Observable<Activity[]>;
  sessions$: Observable<Session[]>;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private dialog: ZardDialogService
  ) {
    this.activities$ = this.adminService.getActivities();

    this.sessions$ = this.activityControl.valueChanges.pipe(
      startWith(''),
      switchMap(activityId => {
        if (!activityId) return of([]);
        return this.refresh$.pipe(
          startWith(void 0),
          switchMap(() => this.adminService.getSessionsByActivity(Number(activityId)))
        );
      })
    );

    this.initForm();
  }

  private initForm() {
    this.sessionForm = this.fb.group({
      name: ['', Validators.required],
      sessionDate: ['', Validators.required],
      activityId: ['', Validators.required],
    });
  }

  openCreateDialog() {
    this.isEditing = false;
    this.sessionForm.reset();

    // Auto-select activity if one is already filtered
    if (this.activityControl.value) {
      this.sessionForm.patchValue({ activityId: this.activityControl.value });
    }

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Session',
      zContent: this.sessionDialog,
      zOkText: 'Create',
      zOnOk: () => {
        this.submitSession();
        return false;
      },
    });
  }

  openEditDialog(session: Session) {
    this.isEditing = true;
    this.selectedSessionId = session.id;

    // Format date for input[type="date"]
    const date = new Date(session.sessionDate).toISOString().split('T')[0];
    this.sessionForm.patchValue({
      ...session,
      sessionDate: date
    });

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Session',
      zContent: this.sessionDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.submitSession();
        return false;
      },
    });
  }

  submitSession() {
    if (this.sessionForm.invalid) {
      toast.error('Please fill all required fields');
      return;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.adminService.updateSession(this.selectedSessionId!, this.sessionForm.value)
      : this.adminService.createSession(this.sessionForm.value);

    obs.subscribe({
      next: () => {
        toast.success(`Session ${this.isEditing ? 'updated' : 'created'} successfully`);
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        toast.error(err.error?.message || 'Something went wrong');
        this.isSubmitting = false;
      }
    });
  }

  deactivateSession(id: number) {
    if (!confirm('Are you sure you want to deactivate this session?')) return;

    this.adminService.deactivateSession(id).subscribe({
      next: () => {
        toast.success('Session deactivated');
        this.refresh$.next();
      },
      error: (err) => toast.error(err.error?.message || 'Failed to deactivate')
    });
  }
}
