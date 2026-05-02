import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, TemplateRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest, map, shareReplay, startWith, switchMap, tap, forkJoin, of, catchError } from 'rxjs';
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
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { ApiService } from '../../core/services/api';

@Component({
    selector: 'app-outreach-workers',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        ZardTableComponent,
        ZardTableHeaderComponent,
        ZardTableBodyComponent,
        ZardTableRowComponent,
        ZardTableHeadComponent,
        ZardTableCellComponent,
        ZardButtonComponent,
        ZardInputDirective,
        ZardDialogModule,
        ZardFormControlComponent,
        ZardFormFieldComponent,
        ZardFormLabelComponent,
        ZardIconComponent,
        ZardComboboxComponent,
        LottieComponent,
    ],
    templateUrl: './outreach-workers.html',
    styleUrl: './outreach-workers.css',
})
export class OutreachWorkers implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('requestDialog') requestDialog!: TemplateRef<any>;
    @ViewChild('tagDialog') tagDialog!: TemplateRef<any>;
    @ViewChild('removeOutreachDialog') removeOutreachDialog!: TemplateRef<any>;
    @ViewChild('detailsDialog') detailsDialog!: TemplateRef<any>;

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
    tagLocations = signal<any[]>([]);
    projectOptions: ZardComboboxOption[] = [];
    stateOptions = signal<ZardComboboxOption[]>([]);

    detailsWorker: OutreachWorker | null = null;
    detailsProjects: any[] = [];
    detailsLoading = signal(false);
    detailsLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };

    isLoadingWorkers = false;
    options: AnimationOptions = { path: '/loading.json' };
    private refreshTimer: ReturnType<typeof setInterval> | null = null;

    projectToRemoveCtrl = new FormControl('', Validators.required);
    workerProjects: ZardComboboxOption[] = [];
    fetchingWorkerProjects = false;
    removingProjectLoading = signal<boolean>(false);
    targetWorkerForRemoval: OutreachWorker | null = null;
    removeDialogRef!: ZardDialogRef<any>;

    readonly pageSize = 10;
    private readonly page$ = new BehaviorSubject<number>(1);
    private lastPage = 1;
    private lastTotalPages = 1;

    private readonly refresh$ = new BehaviorSubject<void>(undefined);
    pager$!: Observable<{
        items: OutreachWorker[];
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        from: number;
        to: number;
    }>;

    readonly search$ = new BehaviorSubject<string>('');
    readonly statusFilter$ = new BehaviorSubject<string>('ALL');

    readonly statusOptions = [
        { value: 'ALL', label: 'All Status' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' }
    ];

    constructor(
        private fb: FormBuilder,
        private managerService: ManagerService,
        private dialog: ZardDialogService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private api: ApiService
    ) {
        this.initForm();
        this.initPager();
    }

    private initPager() {
        const baseWorkers$ = this.refresh$.pipe(
            tap(() => this.isLoadingWorkers = true),
            switchMap(() => this.managerService.getOutreachWorkers()),
            map((workers) => Array.isArray(workers) ? workers.filter(w => ['ACTIVE', 'INACTIVE'].includes(w.status)) : []),
            tap(() => this.isLoadingWorkers = false),
            shareReplay({ bufferSize: 1, refCount: true })
        );

        this.pager$ = combineLatest([baseWorkers$, this.page$, this.search$, this.statusFilter$]).pipe(
            map(([workers, page, search, status]) => {
                let filtered = [...workers];

                if (status !== 'ALL') {
                    filtered = filtered.filter(w => w.status === status);
                }

                if (search) {
                    const q = search.toLowerCase();
                    filtered = filtered.filter(w => 
                        w.name.toLowerCase().includes(q) || 
                        w.email.toLowerCase().includes(q) ||
                        (w.usercode || '').toLowerCase().includes(q)
                    );
                }

                const total = filtered.length;
                const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
                const safePage = Math.min(Math.max(1, page), totalPages);
                const startIndex = (safePage - 1) * this.pageSize;
                const items = filtered.slice(startIndex, startIndex + this.pageSize);
                const from = total === 0 ? 0 : startIndex + 1;
                const to = total === 0 ? 0 : Math.min(startIndex + this.pageSize, total);
                return { items, page: safePage, pageSize: this.pageSize, total, totalPages, from, to };
            }),
            tap((vm) => {
                this.lastPage = vm.page;
                this.lastTotalPages = vm.totalPages;
            }),
            shareReplay({ bufferSize: 1, refCount: true })
        );
    }

    ngOnInit() {
        this.loadProjects();
        // this.loadWorkers(); // Logic moved to pager
        this.refreshTimer = setInterval(() => this.loadWorkers(), 30000); // Slower refresh for pager safety
    }

    ngAfterViewInit() {
        // Pager handles initial load via BehaviorSubject(undefined)
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

    formatLocationLabel(l: any): string {
        if (!l) return '';
        const code = (l.locationCode ?? '').toString().trim();
        const name = l.name || l.label || l.stateName || '';
        return [code, name].filter(Boolean).join(' - ');
    }

    getLocationPart(val: any): string {
        if (!val) return '—';
        return (val?.name || val).toString();
    }

    openDetailsDialog(worker: OutreachWorker) {
        this.detailsWorker = worker;
        this.detailsLoading.set(true);

        this.managerService.getProjects(worker.id).subscribe({
            next: (projects) => {
                this.detailsProjects = (projects || []).map(p => ({
                    ...p,
                    name: p.name || p.project?.name || 'Project',
                    projectCode: p.projectCode || p.code || p.project?.projectCode || '-',
                    // The backend returns assigned states in the 'awcs' field for user-specific project lists
                    states: p.awcs || []
                }));
                this.detailsLoading.set(false);
                this.openDetailsDialogUI(worker);
            },
            error: () => {
                this.detailsProjects = [];
                this.detailsLoading.set(false);
                this.openDetailsDialogUI(worker);
            }
        });
    }

    private openDetailsDialogUI(worker: OutreachWorker) {
        this.dialog.create({
            zTitle: `Assigned Projects: ${worker.name}`,
            zContent: this.detailsDialog,
            zOkText: 'Close',
            zCancelText: null,
            zOnOk: () => {
                this.detailsWorker = null;
                this.detailsProjects = [];
            },
            zOnCancel: () => {
                this.detailsWorker = null;
                this.detailsProjects = [];
            }
        });
    }

    private initForm() {
        this.requestForm = this.fb.group({
            usercode: [{ value: '', disabled: true }],
            name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
            password: [''],
            reason: [''],
        });

        this.tagForm = this.fb.group({
            projectId: ['', Validators.required],
            stateId: [{ value: '', disabled: true }, Validators.required],
        });

        this.tagForm.get('projectId')?.valueChanges.subscribe((projectId) => {
            const stateControl = this.tagForm.get('stateId');
            stateControl?.reset('', { emitEvent: false });
            this.tagLocations.set([]);
            this.stateOptions.set([]);

            const numericProjectId = Number(projectId);
            if (!numericProjectId) {
                stateControl?.disable({ emitEvent: false });
                return;
            }

            stateControl?.enable({ emitEvent: false });
            this.managerService.getAssignedLocations(numericProjectId).subscribe({
                next: (locations) => {
                    const nextLocations = Array.isArray(locations) ? locations : [];
                    this.tagLocations.set(nextLocations);
                    this.stateOptions.set(nextLocations.map((l) => ({
                        value: String(l.id),
                        label: this.formatLocationLabel(l),
                    })));
                },
                error: () => toast.error('Failed to load assigned states'),
            });
        });
    }

    loadWorkers() {
        this.refresh$.next();
    }

    onSearch(query: string) {
        this.search$.next(query);
        this.page$.next(1);
    }

    onStatusChange(status: string | null) {
        this.statusFilter$.next(status || 'ALL');
        this.page$.next(1);
    }

    goToPage(page: number) {
        this.page$.next(Math.max(1, Math.floor(Number(page) || 1)));
    }

    prevPage() {
        this.page$.next(Math.max(1, this.lastPage - 1));
    }

    nextPage() {
        this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1));
    }

    openTagDialog(worker: OutreachWorker) {
        this.taggingWorker = worker;
        this.tagForm.reset({ projectId: '', stateId: '' });
        this.tagLocations.set([]);
        this.stateOptions.set([]);
        this.tagForm.get('stateId')?.disable({ emitEvent: false });

        this.tagDialogRef = this.dialog.create({
            zTitle: 'Tag Project & State',
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
            next: (projects) => {
                this.projects = Array.isArray(projects) ? projects : [];
                this.projectOptions = this.projects.map((p) => ({
                    value: String(p.id),
                    label: p.name,
                }));
            },
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
        const stateId = Number(raw.stateId);
        if (!Number.isFinite(projectId) || !Number.isFinite(stateId)) {
            toast.error('Invalid project/state selection');
            return;
        }

        this.isTagging = true;
        this.managerService.tagOutreachWorkerProjectLocation(this.taggingWorker.id, projectId, stateId).subscribe({
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
            usercode: { value: '', disabled: true },
            name: '',
            email: '',
            mobile: '',
            password: '',
            reason: ''
        });

        this.configureValidators(action);

        if (worker) {
            this.requestForm.patchValue({
                usercode: worker.usercode || '',
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
            this.populateNextWorkerCode();
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
            requestData.usercode = formValue.usercode;
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

    private populateNextWorkerCode(): void {
        this.managerService
            .getNextOutreachCode()
            .subscribe({
                next: (res: any) => {
                    const raw = res?.code ?? res?.nextCode ?? res?.usercode ?? res?.data?.code ?? res?.data?.nextCode;
                    const code = raw == null ? '' : String(raw).trim();
                    if (code) {
                        this.requestForm.get('usercode')?.setValue(code, { emitEvent: false });
                    }
                },
                error: () => {
                    // Fallback
                    this.requestForm.get('usercode')?.setValue('OW01', { emitEvent: false });
                },
            });
    }

    openRemoveDialog(worker: OutreachWorker) {
        this.targetWorkerForRemoval = worker;
        this.projectToRemoveCtrl.reset();
        this.workerProjects = [];
        this.fetchingWorkerProjects = true;
        
        this.api.get(`projects/user/${worker.id}`).subscribe({
            next: (projects: any) => {
                const list = Array.isArray(projects) ? projects : (projects?.data || []);
                this.workerProjects = list.map((p: any) => ({
                    label: `${p.name} ${p.projectCode ? '(' + p.projectCode + ')' : ''}`,
                    value: p.id.toString()
                }));
                this.fetchingWorkerProjects = false;
                this.cdr.detectChanges();
            },
            error: () => {
                toast.error('Failed to load worker projects');
                this.fetchingWorkerProjects = false;
                this.cdr.detectChanges();
            }
        });

        this.removeDialogRef = this.dialog.create({
            zTitle: `Remove ${worker.name} from Project`,
            zContent: this.removeOutreachDialog,
            zOkText: 'Remove',
            zOkLoading: this.removingProjectLoading,
            zOnOk: () => {
                this.submitRemoveProject();
                return false;
            },
            zOnCancel: () => {
                this.targetWorkerForRemoval = null;
            }
        });
    }

    submitRemoveProject() {
        if (this.projectToRemoveCtrl.invalid || !this.targetWorkerForRemoval) {
            toast.error('Please select a project');
            return;
        }
        const projectId = Number(this.projectToRemoveCtrl.value);
        this.removingProjectLoading.set(true);

        this.api.delete(`users/outreach/${this.targetWorkerForRemoval.id}/project/${projectId}`).subscribe({
            next: () => {
                toast.success('Outreach worker removed from project successfully');
                this.removingProjectLoading.set(false);
                this.removeDialogRef.close();
                this.loadWorkers();
            },
            error: (err: any) => {
                const errorMessage = err?.error?.message || err?.message || 'Failed to remove from project';
                toast.error(errorMessage);
                this.removingProjectLoading.set(false);
            }
        });
    }
}
