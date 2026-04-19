import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map, of, shareReplay, switchMap, catchError, startWith } from 'rxjs';
import { AdminService } from '../../admin/admin.service';
import { ManagerService } from '../../manager/manager.service';
import { UserProfileService } from './user-profile.service';

@Injectable({ providedIn: 'root' })
export class RequestCountService {
  private readonly adminService = inject(AdminService);
  private readonly managerService = inject(ManagerService);
  private readonly profileService = inject(UserProfileService);
  
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly pendingCount$ = combineLatest([
    this.profileService.profile$,
    this.refresh$
  ]).pipe(
    switchMap(([profile]) => {
      const roles = (profile.roles || []).map(r => r.toUpperCase());
      
      if (roles.includes('ADMIN')) {
        return combineLatest([
          this.adminService.getBeneficiaryRequests().pipe(catchError(() => of([]))),
          this.adminService.getAccountRequests().pipe(catchError(() => of([])))
        ]).pipe(
          map(([ben, acc]) => {
            const benArr = Array.isArray(ben) ? ben : [];
            const accArr = Array.isArray(acc) ? acc : [];
            const combined = [...benArr, ...accArr];
            
            // Deduplicate by ID
            const unique = Array.from(new Map(combined.map(r => [r.id, r])).values());
            
            return unique.filter(r => String(r.status || r.state || r.requestStatus || 'PENDING').toUpperCase() === 'PENDING').length;
          })
        );
      }
      
      if (roles.includes('MANAGER')) {
        return combineLatest([
          this.managerService.getBeneficiaryRequests().pipe(catchError(() => of([]))),
          this.managerService.getPendingRequests().pipe(catchError(() => of([])))
        ]).pipe(
          map(([ben, prof]) => {
            const benArr = Array.isArray(ben) ? ben : [];
            const profArr = Array.isArray(prof) ? prof : [];
            const combined = [...benArr, ...profArr];
            
            // Deduplicate by ID
            const unique = Array.from(new Map(combined.map(r => [r.id, r])).values());
            
            return unique.filter(r => String(r.status || r.state || r.requestStatus || 'PENDING').toUpperCase() === 'PENDING').length;
          })
        );
      }
      
      return of(0);
    }),
    startWith(0),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  refresh() {
    this.refresh$.next();
  }
}
