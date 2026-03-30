import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
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
import { ZardFormControlComponent, ZardFormFieldComponent, ZardFormLabelComponent } from '@/shared/components/form';
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
        ZardFormLabelComponent,
        ZardIconComponent,
        LottieComponent,
    ],
    templateUrl: './outreach-workers.html',
    styleUrl: './outreach-workers.css',
})
export class OutreachWorkers implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('requestDialog') requestDialog!: TemplateRef<any>;
    @ViewChild('tagDialog') tagDialog!: TemplateRef<any>;

    workers: OutreachWorker[] = [];
    isSubmitting = false;
    requestForm!: FormGroup;
    dialogRef!: ZardDialogRef<any>;
    tagForm!: FormGroup;
    tagDialogRef!: ZardDialogRef<any>;
    currentAction: 'CREATE' | 'MODIFY' | 'DEACTIVATE' | 'ACTIVATE' = 'CREATE';
    selectedWorker: OutreachWorker | null = null;
    taggingWorker: OutreachWorker | null = null;
    isTagging = false;
    projects: any[] = [];
    tagLocations: any[] = [];
    isLoadingWorkers = false;
    options: AnimationOptions = { path: '/loading.json' };
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

    getWorkerProjectsLabel(worker: OutreachWorker): string {
        const assignments = (worker as any)?.projectAssignments;
        if (Array.isArray(assignments) && assignments.length) {
            const seen = new Set<number>();
            const labels = assignments
                .map((a: any) => a?.project)
                .filter(Boolean)
                .filter((p: any) => {
                    const id = Number(p?.id);
                    if (!Number.isFinite(id) || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                })
                .map((p: any) => (p?.name ?? p?.title ?? (p?.id ? `#${p.id}` : '')).toString().trim())
                .filter(Boolean);
            return labels.length ? labels.join(', ') : '-';
        }

        const projects = (worker as any)?.projects;
        if (Array.isArray(projects) && projects.length) {
            const labels = projects
                .map((p: any) => (p?.name ?? p?.title ?? (p?.id ? `#${p.id}` : '')).toString().trim())
                .filter(Boolean);
            return labels.length ? labels.join(', ') : '-';
        }

        const projectIds = (worker as any)?.projectIds;
        if (Array.isArray(projectIds) && projectIds.length) {
            const labels = projectIds.map((id: any) => `#${id}`).join(', ');
            return labels || '-';
        }

        if (worker.projectId) return `#${worker.projectId}`;
        return '-';
    }

    getWorkerMobile(worker: OutreachWorker): string {
        const raw = (worker as any)?.mobile ?? (worker as any)?.mobileNumber ?? (worker as any)?.phone ?? '';
        const value = raw == null ? '' : raw.toString().trim();
        return value || '-';
    }

    private initForm() {
        this.requestForm = this.fb.group({
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
            password: [''],
            reason: [''],
        });

        this.tagForm = this.fb.group({
            projectId: ['', Validators.required],
            locationId: [{ value: '', disabled: true }, Validators.required],
        });

        this.tagForm.get('projectId')?.valueChanges.subscribe((projectId) => {
            const locationControl = this.tagForm.get('locationId');
            locationControl?.reset('', { emitEvent: false });
            this.tagLocations = [];

            const numericProjectId = Number(projectId);
            if (!numericProjectId) {
                locationControl?.disable({ emitEvent: false });
                return;
            }

            locationControl?.enable({ emitEvent: false });
            this.managerService.getAssignedLocations(numericProjectId).subscribe({
                next: (locations) => {
                    const nextLocations = Array.isArray(locations) ? locations : [];
                    // Defer to next tick to avoid NG0100 during the same CD pass.
                    setTimeout(() => {
                        this.tagLocations = nextLocations;
                    }, 0);
                },
                error: () => toast.error('Failed to load assigned locations'),
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

    openTagDialog(worker: OutreachWorker) {
        this.taggingWorker = worker;
        this.tagForm.reset({ projectId: '', locationId: '' });
        this.tagLocations = [];
        this.tagForm.get('locationId')?.disable({ emitEvent: false });

        this.tagDialogRef = this.dialog.create({
            zTitle: 'Tag Project & Location',
            zContent: this.tagDialog,
            zOkText: 'Tag',
            zOnOk: () => {
                this.submitTag();
                return false;
            },
        });
    }

    private loadProjects() {
        const currentUser = this.authService.getCurrentUser();
        this.managerService.getProjects(currentUser?.sub).subscribe({
            next: (projects) => (this.projects = Array.isArray(projects) ? projects : []),
            error: () => toast.error('Failed to load projects'),
        });
    }

    submitTag() {
        if (this.isTagging) return;
        if (this.tagForm.invalid || !this.taggingWorker?.id) {
            toast.error('Please select project and location');
            return;
        }

        const raw = this.tagForm.getRawValue();
        const projectId = Number(raw.projectId);
        const locationId = Number(raw.locationId);
        if (!Number.isFinite(projectId) || !Number.isFinite(locationId)) {
            toast.error('Invalid project/location selection');
            return;
        }

        this.isTagging = true;
        this.managerService.tagOutreachWorkerProjectLocation(this.taggingWorker.id, projectId, locationId).subscribe({
            next: (res) => {
                const msg = res?.message || 'Tagged successfully';
                toast.success(msg);
                this.tagDialogRef.close();
                this.isTagging = false;
                setTimeout(() => this.loadWorkers(), 0);
            },
            error: (err) => {
                toast.error(err?.error?.message || 'Failed to tag project/location');
                this.isTagging = false;
            },
        });
    }

    openRequestDialog(action: 'CREATE' | 'MODIFY' | 'DEACTIVATE' | 'ACTIVATE', worker?: OutreachWorker) {
        this.currentAction = action;
        this.selectedWorker = worker || null;
        this.requestForm.reset({
            name: '',
            email: '',
            mobile: '',
            password: '',
            reason: ''
        });

        this.configureValidators(action);

        if (worker) {
            this.requestForm.patchValue({
                name: worker.name,
                email: worker.email,
                mobile: worker.mobile ?? (worker as any).mobileNumber ?? (worker as any).phone ?? '',
            });
            if (action === 'DEACTIVATE' || action === 'ACTIVATE') {
                this.requestForm.get('name')?.disable();
                this.requestForm.get('email')?.disable();
                this.requestForm.get('mobile')?.disable();
                this.requestForm.get('password')?.disable();
            } else {
                this.requestForm.get('name')?.enable();
                this.requestForm.get('email')?.enable();
                this.requestForm.get('mobile')?.enable();
                this.requestForm.get('password')?.enable();
            }
        } else {
            this.requestForm.get('name')?.enable();
            this.requestForm.get('email')?.enable();
            this.requestForm.get('mobile')?.enable();
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
        const mobileControl = this.requestForm.get('mobile');
        const reasonControl = this.requestForm.get('reason');
        if (action === 'CREATE') {
            passwordControl?.setValidators([Validators.required, Validators.minLength(6)]);
            mobileControl?.setValidators([Validators.required, Validators.pattern('^[0-9]{10}$')]);
            reasonControl?.clearValidators();
        } else {
            passwordControl?.clearValidators();
            mobileControl?.setValidators([Validators.required, Validators.pattern('^[0-9]{10}$')]);
            if (action === 'DEACTIVATE' || action === 'ACTIVATE') {
                reasonControl?.setValidators([Validators.required]);
            } else {
                reasonControl?.clearValidators();
            }
        }
        passwordControl?.updateValueAndValidity();
        mobileControl?.updateValueAndValidity();
        reasonControl?.updateValueAndValidity();
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
            workerId: this.selectedWorker?.id
        };

        if (this.currentAction === 'CREATE') {
            requestData.name = formValue.name;
            requestData.email = formValue.email;
            requestData.mobile = formValue.mobile;
            requestData.password = formValue.password;
        }

        if (this.currentAction === 'MODIFY') {
            requestData.name = formValue.name;
            requestData.email = formValue.email;
            requestData.mobile = formValue.mobile;
        }

        if (this.currentAction === 'DEACTIVATE' || this.currentAction === 'ACTIVATE') {
            requestData.reason = formValue.reason;
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
