import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, catchError, shareReplay, tap, throwError } from 'rxjs';

export type ApiCacheMode = 'default' | 'no-cache' | 'reload';

export interface ApiGetOptions {
  cache?: ApiCacheMode;
  ttlMs?: number;
  cacheKey?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  public baseUrl = environment.apiUrl;

  private readonly defaultTtlMs = 2 * 60 * 1000;
  private readonly cache = new Map<string, { expiresAt: number; value$: Observable<unknown> }>();

  constructor(private http: HttpClient) { }

  clearCache(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  post<T = unknown>(url: string, data: any) {
    return this.http.post<T>(`${this.baseUrl}/${url}`, data).pipe(
      tap(() => this.clearCache()),
    );
  }

  get<T = unknown>(url: string, params?: any, options?: ApiGetOptions) {
    const fullUrl = `${this.baseUrl}/${url}`;
    const mode: ApiCacheMode = options?.cache ?? 'default';

    if (mode === 'no-cache') {
      return this.http.get<T>(fullUrl, { params });
    }

    this.pruneExpired();

    const cacheKey = options?.cacheKey ?? this.buildCacheKey(fullUrl, params);
    if (mode !== 'reload') {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.value$ as Observable<T>;
    }

    const ttlMs = Number.isFinite(options?.ttlMs) ? Math.max(0, Number(options?.ttlMs)) : this.defaultTtlMs;

    const request$ = this.http.get<T>(fullUrl, { params }).pipe(
      catchError((err) => {
        this.cache.delete(cacheKey);
        return throwError(() => err);
      }),
      shareReplay(1),
    );

    this.cache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value$: request$ });
    return request$;
  }

  // PUT
  put<T = unknown>(url: string, data: any) {
    return this.http.put<T>(`${this.baseUrl}/${url}`, data).pipe(
      tap(() => this.clearCache()),
    );
  }

  // PATCH
  patch<T = unknown>(url: string, data: any) {
    return this.http.patch<T>(`${this.baseUrl}/${url}`, data).pipe(
      tap(() => this.clearCache()),
    );
  }

  // DELETE
  delete<T = unknown>(url: string) {
    return this.http.delete<T>(`${this.baseUrl}/${url}`).pipe(
      tap(() => this.clearCache()),
    );
  }

  private pruneExpired(now = Date.now()) {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }

  private buildCacheKey(fullUrl: string, params?: unknown) {
    if (params instanceof HttpParams) {
      const serialized = params.toString();
      return serialized ? `${fullUrl}?${serialized}` : fullUrl;
    }

    const serialized = this.stableStringify(params);
    return serialized ? `${fullUrl}?p=${serialized}` : fullUrl;
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim() ? JSON.stringify(value) : '';
    if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.length ? `[${value.map((v) => this.stableStringify(v)).join(',')}]` : '';
    if (typeof value !== 'object') return JSON.stringify(value);

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (!keys.length) return '';

    return `{${keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify(record[k])}`).join(',')}}`;
  }
}

export class Api { }
