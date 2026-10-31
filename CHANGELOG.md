# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-30

### Added
- **Server-Side Query Pagination for Approval Requests (Admin, Manager, Outreach)**:
  - Implemented end-to-end query pagination (`?page=1&limit=10`) across all approval request endpoints and views, replacing inefficient in-memory client-side array slicing.
  - Standardized response payload contract across all request APIs:
    ```json
    {
      "data": [ /* paginated items */ ],
      "meta": {
        "total": 45,
        "page": 1,
        "limit": 10,
        "totalPages": 5
      }
    }
    ```

#### Backend Implementation (`backend/src/`):
- **Admin Module**:
  - [`admin.controller.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/backend/src/admin/admin.controller.ts): Updated `GET /admin/beneficiary-requests` and `GET /admin/profile-requests` to accept query parameters (`@Query() query: { page, limit, status, type, search, all }`).
  - [`admin.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/backend/src/admin/admin.service.ts): Updated `getManagerBeneficiaryRequests` to execute `prisma.$transaction([count, findMany])` using `skip = (page - 1) * limit` and `take = limit`. Related `Beneficiary` data is now enriched only for the 10 paginated records instead of the entire database table. Preserved backward compatibility for unpaginated count calls.
- **Manager Module**:
  - [`manager.controller.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/backend/src/manager/manager.controller.ts):
    - Added dedicated unified endpoint `GET /manager/incoming-requests` with query pagination for all incoming requests targeted to the manager.
    - Updated `GET /manager/beneficiary-requests`, `GET /manager/profile-requests`, and `GET /manager/my-requests` to support query pagination parameters.
  - [`manager.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/backend/src/manager/manager.service.ts):
    - Added `getIncomingRequests` method supporting pagination, status filtering, and targeted beneficiary enrichment.
    - Updated `getMyRequests` to perform server-side `skip`/`take` pagination and targeted entity lookups (`beneficiary` and `worker`) exclusively on the paginated slice.
- **Outreach Module**:
  - [`outreach.controller.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/backend/src/outreach/outreach.controller.ts): Updated `GET /outreach/my-requests` to accept query pagination parameters.
  - [`outreach.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/backend/src/outreach/outreach.service.ts): Refactored `getMyRequests` to use Prisma transaction count + findMany with pagination, returning standardized `{ data, meta }`.

#### Frontend Implementation (`jeevan-setu-frontend/src/app/`):
- **API Services**:
  - [`admin.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/admin/admin.service.ts): Updated `getBeneficiaryRequests(params)` and `getAccountRequests(params)` to transmit query parameters via `ApiService`.
  - [`manager.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/manager.service.ts): Added `getIncomingRequests(params)` and updated `getMyRequests(params)` to pass query parameters.
  - [`outreach.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/outreach/outreach.service.ts): Updated `getMyRequests(params)` to pass query parameters.
  - [`request-count.service.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/core/services/request-count.service.ts): Updated array unwrapping to seamlessly support both paginated `{ data, meta }` and raw arrays without breaking pending count badges.
- **Views & Reactive Streams**:
  - **Admin Requests** ([`requests.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/admin/requests/requests.ts)): Replaced forkJoin and client-side array slicing with reactive `combineLatest([page$, refresh$]).pipe(switchMap(...))` querying the server per page and binding directly to `res.meta`.
  - **Manager Requests** ([`requests.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/requests/requests.ts)):
    - `incomingPager$`: Now directly fetches from `getIncomingRequests({ page, limit })` via `incomingPage$`, eliminating client-side dual-endpoint merging.
    - `myPager$`: Powered by `myPage$` calling `getMyRequests({ page, limit })` with server-side pagination.
  - **Outreach Requests** ([`requests.ts`](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/outreach/requests/requests.ts)): Replaced in-memory slicing in `vm$` with server-side pagination driven by `page$` and mapped to `ZardPaginationComponent`.

---

## [2026-06-20]

### Added
- **Outreach Beneficiaries**: Added a "View" button to the Desktop table view in the `Beneficiaries` component, linking directly to the beneficiary profile details view.
- **Outreach Activity Report**:
  - Overhauled Pregnancy Status dropdown to support specific statuses (`Currently Pregnant`, `Still Birth`, `Baby Delivered`, `Miscarriage/Aborted`).
  - Added dynamically rendered date fields based on pregnancy status: `LMP Date` (pregnant), `Date` (still birth/miscarriage), and `Date of Delivery` (baby delivered).
  - Implemented a "Baby Details" sub-form that automatically registers a newly born baby as a family member when "Baby Delivered" is selected.
  - Added readonly, auto-calculated `Age` and `Group` display fields that populate dynamically based on the selected target beneficiary/family member.

### Fixed
- **Outreach Activity Report**: Fixed a UI bug where the "Main Beneficiary" option wasn't properly selected in the Target Person combobox by default.

### Removed
- **Groups Component**: Completely removed the Groups component files from the admin module (`src/app/admin/groups/`).
- **Groups Route**: Removed `/admin/groups` route configuration from `admin-routing-module.ts`.
- **Layout Sidebar**: Removed the "Groups" link from the sidebar in `layout.html`.
- **Admin Dashboard**:
  - Removed "Total Groups" stats card from `dashboard.html`.
  - Removed "Recent Groups" card from `dashboard.html`.
  - Removed all corresponding properties, observables, and helper methods from `dashboard.ts`.
  - Adjusted statistics and recently-created cards grids layout columns from 3 columns to 2 columns in `dashboard.html`.

### Changed
- **Outreach Dynamics**: Redesigned tabs into a multi-colored card grid (styled similarly to activity sessions cards) that displays corresponding table data when clicked, highlighting the currently selected card.
- **Activity / Sessions**: Redesigned activity/sessions cards into clickable button cards that filter a new paginated details table when clicked, complete with custom colored highlights for the active state.
- **Outreach Dashboard**: Redesigned the Outreach Worker dashboard interface with new metrics, dynamic mock data grids ("Outreach Action", "Coverage Dashboard", "Activity / Sessions"), and standardized all action buttons to a cohesive style. Replaced all native select filters with the searchable `<z-combobox>` component.
- **Outreach Layout**: Updated the main desktop navigation header to feature the new project logo (`Landing.png`) and added a sidebar toggle menu icon on the right for cleaner aesthetics.
- **Design Specifications**: Reviewed and updated design specification files for [OUTREACH_MOBILE_LAYOUT_SPEC.md](file:///C:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/Design/OUTREACH_MOBILE_LAYOUT_SPEC.md) and [OUTREACH_TYPOGRAPHY_SPEC.md](file:///C:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/Design/OUTREACH_TYPOGRAPHY_SPEC.md) to document current fully implemented mobile status, mapping actual Angular layout, headers, cards components and CSS style tokens.
- **Manager Layout**: Implemented mobile-first layout structure in manager module layout shell ([layout.html](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/layout/layout.html), [layout.ts](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/layout/layout.ts), [layout.css](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/layout/layout.css)). Added centered header, route-aware back-navigation mapping, mobile bottom navigation bar (Home, Requests, Workers, Beneficiaries tabs), and sidebar hamburger toggles using manager's emerald/green color scheme.
