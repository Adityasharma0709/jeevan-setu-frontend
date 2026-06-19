# Pregnancy Status Analysis

This note summarizes how `pregnancyStatus` is used across the frontend and backend so the business flow is easy to review in one place.

## Frontend

### Where it is captured

- `src/app/outreach/report-activity/report-activity.ts`
  - Defines `pregnancyStatus` and `lmpDate` in the report form.
  - Shows pregnancy fields only for female beneficiaries or children aged 14+ through `showPregnancy`.
  - Shows `lmpDate` only when `pregnancyStatus === 'Yes'` through `showLmpDate`.
  - On submit, stores `pregnancyStatus` in `reportData`.
  - Stores `lmpDate` only when pregnancy status is `Yes`.

- `src/app/outreach/report-activity/report-activity.html`
  - Renders the `Pregnancy Status` combobox.
  - Renders the `LMP Date` field conditionally.

### Where it is displayed

- `src/app/outreach/activity/activity.html`
  - Shows a `Pregnant` badge when `report.reportData?.pregnancyStatus === 'Yes'`.
  - Shows `LMP` when `lmpDate` exists.

- `src/app/outreach/activity/activity.ts`
  - Includes pregnancy data in the search summary text.
  - Exports `Pregnancy Status` and `LMP Date` to Excel.

- `src/app/outreach/profile-view/profile-view.html`
  - Shows a `Pregnant` badge when `pregnancyStatus === 'Yes'`.

- `src/app/analyst/dashboard/dashboard.html`
  - Displays `Pregnancy Status` and `LMP Date` in the analyst table.

- `src/app/analyst/dashboard/dashboard.ts`
  - Passes `pregnancyStatus` and `lmpDate` through into the analyst export dataset.

### Frontend behavior summary

- `Yes` is the only value that triggers the `Pregnant` display and the `LMP Date` field.
- `Lactating` and `Aborted` are still treated as valid frontend values, but they do not trigger the `Pregnant` badge.
- So in the frontend, `pregnancyStatus` behaves like a general reproductive-status field, not only a binary pregnant/not-pregnant flag.

## Backend

### Where it is defined

- `src/outreach/dto/create-report.dto.ts`
  - Declares `pregnancyStatus` inside `ReportDataDto`.
  - Documents that it is only applicable for female beneficiaries aged 14+.
  - Documents that `lmpDate` is present only when `pregnancyStatus = 'Yes'`.
  - Also defines `samMamStatus`.

### Where it is stored

- `src/outreach/outreach.service.ts`
  - `submitReport()` stores `dto.reportData` directly into `ActivityReport.reportData`.
  - `updateReport()` merges incoming `dto.reportData` into the existing JSON payload.
  - There is no backend-specific pregnancy business logic beyond storage and retrieval.

- `prisma/schema.prisma`
  - `ActivityReport.reportData` is a `Json` column.
  - That means pregnancy fields are stored inside JSON, not as separate database columns.

### Where it is returned

- `src/outreach/outreach.service.ts`
  - `getReport()` returns the stored report.
  - `getMyReports()` returns reports with `reportData` intact.

- `src/users/users.service.ts`
  - `getAnalystDashboardReports()` passes `reportData` through to the analyst UI payload.

## Important backend caveat

- The DTO comments suggest `pregnancyStatus` should only allow `Yes`.
- However, `CreateReportDto.reportData` is typed as `ReportDataDto | any`, and it is not decorated with nested validation such as `@ValidateNested()` or `@Type(() => ReportDataDto)`.
- Because of that, the backend currently behaves more like a pass-through JSON store for this field than a strict validator.
- In practice, the frontend values `Yes`, `Lactating`, and `Aborted` can be carried through and persisted.

## Overall data flow

1. User selects a beneficiary in the frontend report form.
2. The frontend decides whether to show pregnancy fields based on age and gender.
3. The report payload is submitted with `reportData.pregnancyStatus` and, when applicable, `reportData.lmpDate`.
4. The backend stores the full `reportData` JSON in `ActivityReport.reportData`.
5. Activity pages, profile views, analyst dashboards, and Excel exports all read that same JSON back out.

## Short conclusion

- Frontend: pregnancy status is a visible and conditional form field used for display and export.
- Backend: pregnancy status is stored and relayed, but not strongly validated or transformed.
- If we want consistent business rules, the backend validation should be tightened to match the frontend expectations.
