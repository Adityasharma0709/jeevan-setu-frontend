import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ManagerService, OutreachWorker } from '../manager.service';
import { AuthService } from '../../core/services/auth';
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
    selector: 'app-outreach-workers',
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
        ZardIconComponent
    ],
    templateUrl: './outreach-workers.html',
    styleUrl: './outreach-workers.css',
})
export class OutreachWorkers implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('requestDialog') requestDialog!: TemplateRef<any>;

    workers: OutreachWorker[] = [];
    isSubmitting = false;
    requestForm!: FormGroup;
    dialogRef!: ZardDialogRef<any>;
    currentAction: 'CREATE' | 'MODIFY' | 'DEACTIVATE' | 'ACTIVATE' = 'CREATE';
    selectedWorker: OutreachWorker | null = null;
    projects: any[] = [];
    locations: any[] = [];
    isLoadingWorkers = false;
    private refreshTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private fb: FormBuilder,
        private managerService: ManagerService,
        private dialog: ZardDialogService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) {
        this.initForm();
    }

    ngOnInit() {
        this.loadProjects();
        this.loadWorkers();
        this.refreshTimer = setInterval(() => this.loadWorkers(), 15000);
    }

    ngAfterViewInit() {
        // One post-view safety fetch so list does not depend on any button interaction.
        if (!this.workers.length && !this.isLoadingWorkers) {
            queueMicrotask(() => this.loadWorkers());
        }
    }

    ngOnDestroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    private initForm() {
        this.requestForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            password: [''],
            projectId: [''],
            locationId: [{ value: '', disabled: true }],
            reason: ['', Validators.required]
        });

        this.requestForm.get('projectId')?.valueChanges.subscribe((projectId) => {
            const locationControl = this.requestForm.get('locationId');
            locationControl?.reset('', { emitEvent: false });
            this.locations = [];
            if (!projectId) {
                locationControl?.disable({ emitEvent: false });
                return;
            }
            locationControl?.enable({ emitEvent: false });
            this.managerService.getLocations(Number(projectId)).subscribe({
                next: (locations) => {
                    this.locations = locations;
                },
                error: () => {
                    toast.error('Failed to load locations');
                }
            });
        });
    }

    loadWorkers() {
        this.isLoadingWorkers = true;
        this.managerService.getOutreachWorkers().subscribe({
            next: (workers) => {
                this.workers = Array.isArray(workers) ? workers.filter(w => ['ACTIVE', 'INACTIVE'].includes(w.status)) : [];
                this.isLoadingWorkers = false;
                this.cdr.detectChanges();
            },
            error: () => {
                toast.error('Failed to load outreach workers');
                this.isLoadingWorkers = false;
                this.workers = [];
                this.cdr.detectChanges();
            }
        });
    }

    loadProjects() {
        const currentUser = this.authService.getCurrentUser();
        this.managerService.getProjects(currentUser?.sub).subscribe({
            next: (projects) => {
                this.projects = projects;
            },
            error: () => {
                toast.error('Failed to load projects');
            }
        });
    }

    openRequestDialog(action: 'CREATE' | 'MODIFY' | 'DEACTIVATE' | 'ACTIVATE', worker?: OutreachWorker) {
        this.currentAction = action;
        this.selectedWorker = worker || null;
        this.requestForm.reset({
            name: '',
            email: '',
            password: '',
            projectId: '',
            locationId: '',
            reason: ''
        });
        this.locations = [];

        this.configureValidators(action);

        if (worker) {
            this.requestForm.patchValue({
                name: worker.name,
                email: worker.email,
                projectId: worker.projectId ?? '',
                locationId: worker.locationId ?? ''
            });
            if (action === 'DEACTIVATE' || action === 'ACTIVATE') {
                this.requestForm.get('name')?.disable();
                this.requestForm.get('email')?.disable();
                this.requestForm.get('projectId')?.disable();
                this.requestForm.get('locationId')?.disable();
                this.requestForm.get('password')?.disable();
            } else {
                this.requestForm.get('name')?.enable();
                this.requestForm.get('email')?.enable();
                this.requestForm.get('projectId')?.enable();
                this.requestForm.get('locationId')?.enable();
                this.requestForm.get('password')?.enable();
                if (!this.requestForm.get('projectId')?.value) {
                    this.requestForm.get('locationId')?.disable();
                }
            }
        } else {
            this.requestForm.get('name')?.enable();
            this.requestForm.get('email')?.enable();
            this.requestForm.get('projectId')?.enable();
            this.requestForm.get('locationId')?.disable();
            this.requestForm.get('password')?.enable();
        }

        const titleMap = {
            CREATE: 'Request New Account',
            MODIFY: 'Request Account Modification',
            DEACTIVATE: 'Request Account Deactivation',
            ACTIVATE: 'Request Account Activation'
        };

        this.dialogRef = this.dialog.create({
            zTitle: titleMap[action],
            zContent: this.requestDialog,
            zOkText: 'Submit Request',
            zOnOk: () => {
                this.submitRequest();
                return false;
            },
        });
    }

    private configureValidators(action: 'CREATE' | 'MODIFY' | 'DEACTIVATE' | 'ACTIVATE') {
        const passwordControl = this.requestForm.get('password');
        const projectControl = this.requestForm.get('projectId');
        const locationControl = this.requestForm.get('locationId');
        if (action === 'CREATE') {
            passwordControl?.setValidators([Validators.required, Validators.minLength(6)]);
            projectControl?.setValidators([Validators.required]);
            locationControl?.setValidators([Validators.required]);
        } else {
            passwordControl?.clearValidators();
            projectControl?.clearValidators();
            locationControl?.clearValidators();
        }
        passwordControl?.updateValueAndValidity();
        projectControl?.updateValueAndValidity();
        locationControl?.updateValueAndValidity();
    }

    submitRequest() {
        if (this.requestForm.invalid && !['DEACTIVATE', 'ACTIVATE'].includes(this.currentAction)) {
            toast.error('Please fill required fields');
            return;
        }

        if (['DEACTIVATE', 'ACTIVATE'].includes(this.currentAction) && !this.requestForm.get('reason')?.value) {
            toast.error(`Please provide a reason for ${this.currentAction.toLowerCase()}`);
            return;
        }

        this.isSubmitting = true;
        const formValue = this.requestForm.getRawValue();
        const requestData: any = {
            reason: formValue.reason,
            workerId: this.selectedWorker?.id
        };

        if (this.currentAction === 'CREATE') {
            requestData.name = formValue.name;
            requestData.email = formValue.email;
            requestData.password = formValue.password;
            requestData.projectId = Number(formValue.projectId);
            requestData.locationId = Number(formValue.locationId);
        }

        if (this.currentAction === 'MODIFY') {
            requestData.name = formValue.name;
            requestData.email = formValue.email;
        }

        this.managerService.submitAccountRequest(this.currentAction, requestData).subscribe({
            next: (response) => {
                console.log('[Manager Submit Request Payload]', requestData);
                console.log('[Manager Submit Request Response]', response);
                toast.success('Request submitted to admin for approval');
                this.dialogRef.close();
                setTimeout(() => this.loadWorkers(), 0);
                this.isSubmitting = false;
            },
            error: (err) => {
                console.log('[Manager Submit Request Error]', err);
                toast.error(err.error?.message || 'Submission failed');
                this.isSubmitting = false;
            }
        });
    }
}
