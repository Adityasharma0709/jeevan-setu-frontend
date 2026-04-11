import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, concat, distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';

import { ProfileVm, emptyProfile, normalizeProfile } from '@/shared/utils/profile';
import { ApiService } from './api';
import { AuthService } from './auth';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly profile$ = this.refresh$.pipe(
    switchMap(() => {
      const token = this.auth.getToken();
      if (!token) {
        return of(emptyProfile());
      }

      const fallbackProfile = this.getTokenProfile();

      return concat(
        of(fallbackProfile),
        this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
          map((raw) => this.mergeProfiles(fallbackProfile, normalizeProfile(raw, fallbackProfile.roleLabel))),
          catchError(() => of(fallbackProfile)),
        ),
      );
    }),
    distinctUntilChanged((previous, current) => this.areProfilesEqual(previous, current)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly displayName$ = this.profile$.pipe(
    map((profile) => profile.name || profile.email || profile.roleLabel || ''),
    distinctUntilChanged(),
  );

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  refreshProfile() {
    this.refresh$.next();
  }

  clearProfile() {
    this.refresh$.next();
  }

  private getTokenProfile(): ProfileVm {
    const currentUser = this.auth.getCurrentUser();
    return currentUser ? normalizeProfile(currentUser) : emptyProfile();
  }

  private mergeProfiles(fallbackProfile: ProfileVm, apiProfile: ProfileVm): ProfileVm {
    return {
      name: apiProfile.name || fallbackProfile.name,
      email: apiProfile.email || fallbackProfile.email,
      usercode: apiProfile.usercode || fallbackProfile.usercode,
      id: apiProfile.id || fallbackProfile.id,
      roleLabel: apiProfile.roleLabel || fallbackProfile.roleLabel,
      roles: apiProfile.roles.length ? apiProfile.roles : fallbackProfile.roles,
    };
  }

  private areProfilesEqual(previous: ProfileVm, current: ProfileVm): boolean {
    return previous.name === current.name &&
      previous.email === current.email &&
      previous.usercode === current.usercode &&
      previous.id === current.id &&
      previous.roleLabel === current.roleLabel &&
      previous.roles.join('|') === current.roles.join('|');
  }
}
