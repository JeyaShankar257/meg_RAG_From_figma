# Tasks: Separate Admin Portal

## 1. Authentication Contracts & Backend Portal Alignment

- [x] 1.1 Update `loginSchema` in `apps/api/src/routes/auth/index.ts` to allow `portal: "admin"` and verify that `portal === "admin"` enforces `profile.role === "admin"`. Verify by running backend unit tests `pnpm --filter @mednova/api test`.
- [x] 1.2 Update `PortalRole` in `src/lib/api/apiClient.ts` to `"doctor" | "patient" | "admin"` and update `SessionProvider.tsx` to support the admin portal authentication flow. Verify with `pnpm typecheck`.

## 2. Admin Portal UI Components & Dedicated Pages

- [x] 2.1 Create `src/pages/admin/Login.tsx` with dedicated administrative styling, clear system branding, and secure admin login handling. Verify by navigating to `/admin/login`.
- [x] 2.2 Create `src/components/admin/AdminShell.tsx` providing a top-level administrative header, sidebar navigation (Physicians Roster, Provisioning, Orphan Reconciliation, Audit Logs, Settings), and admin session termination. Verify with `pnpm typecheck`.
- [x] 2.3 Create `src/pages/admin/AdminDashboard.tsx` displaying:
  - Working & existing doctors roster (Name, Email, Role, Approval Status, Temporary Password flag, Workspace ID).
  - Fast-action pending approvals queue (Approve/Reject).
  - Doctor invitation modal with temporary password and email toggles.
  - Temporary password reset modal.
  - Interactive orphan reconciliation scanner and cleanup table.
  Verify component renders without runtime errors and handles real backend data.

## 3. Router Wiring & Doctor Portal Cleanup

- [x] 3.1 Update `src/pages/Landing.tsx` to add a third portal entry card: "Admin Portal" routing to `/admin/login`. Verify by visual inspection.
- [x] 3.2 Update `src/components/doctor/DoctorShell.tsx` to completely remove the `Administration` / `Doctor Accounts` navigation link. Verify no admin links exist in the Doctor sidebar.
- [x] 3.3 Update `src/App.tsx` to mount `/admin/login` and `/admin/*` protected routes using `<RequireRole role="admin">`. Add a redirect from `/doctor/admin/accounts` to `/admin`.
- [x] 3.4 Delete obsolete `src/pages/doctor/AdminDoctorManagement.tsx` now that it is replaced by `src/pages/admin/AdminDashboard.tsx`. Verify with `pnpm typecheck`.

## 4. Verification & Testing

- [x] 4.1 Update frontend auth tests in `src/lib/auth/controlledAuth.test.ts` and backend tests in `apps/api/src/routes/controlledAuth.test.ts` to cover `portal: "admin"` login and admin route protection. Verify by running `pnpm test:frontend` and `pnpm --filter @mednova/api test`.
- [x] 4.2 Run end-to-end typecheck and formatting (`pnpm typecheck` and `pnpm run format:check`) to confirm clean build status.
