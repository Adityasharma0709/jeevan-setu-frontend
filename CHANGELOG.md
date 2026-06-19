# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-06-19

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
- **Design Specifications**: Reviewed and updated design specification files for [OUTREACH_MOBILE_LAYOUT_SPEC.md](file:///C:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/Design/OUTREACH_MOBILE_LAYOUT_SPEC.md) and [OUTREACH_TYPOGRAPHY_SPEC.md](file:///C:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/Design/OUTREACH_TYPOGRAPHY_SPEC.md) to document current fully implemented mobile status, mapping actual Angular layout, headers, cards components and CSS style tokens.
- **Manager Layout**: Implemented mobile-first layout structure in manager module layout shell ([layout.html](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/layout/layout.html), [layout.ts](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/layout/layout.ts), [layout.css](file:///c:/Users/Aditya/Desktop/PROJECTS/JeevanSetu/jeevan-setu-frontend/src/app/manager/layout/layout.css)). Added centered header, route-aware back-navigation mapping, mobile bottom navigation bar (Home, Requests, Workers, Beneficiaries tabs), and sidebar hamburger toggles using manager's emerald/green color scheme.
