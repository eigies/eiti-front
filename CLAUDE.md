# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server at http://localhost:4200
npm run build      # Production build → dist/eiti-front/
npm test           # Run unit tests (Karma/Jasmine)
npm run watch      # Watch mode dev build
```

Run a single test file:
```bash
npx ng test --include='**/auth.service.spec.ts'
```

## Architecture

**Angular 16 SPA** using standalone components (no NgModules). Point-of-sale and business operations interface consuming the `eiti.Api` backend.

- **API endpoints:** `/api` in production, `http://localhost:5133/api` in development (see `src/environments/`)
- **Auth:** JWT stored in `localStorage` under `eiti_token` / `eiti_user`. The `authInterceptor` attaches `Authorization: Bearer <token>` to all requests and handles 401/429 responses.
- **Guards:** `authGuard` (authentication + onboarding check), `permissionGuard` (permission-string based, e.g. `sales.access`, `cash.access`, `users.manage`)
- **State:** No NgRx/Redux. State lives in RxJS `BehaviorSubject`s inside services, persisted to `localStorage` where needed.
- **Routing:** Fully lazy-loaded via `loadComponent()` in `app.routes.ts`. Catch-all redirects to `/login`.

## Project Structure

```
src/app/
├── core/
│   ├── guards/       # authGuard, permissionGuard
│   ├── interceptors/ # authInterceptor (JWT + error handling)
│   ├── models/       # TypeScript interfaces per domain
│   └── services/     # One service per domain (auth, sale, cash, product, …)
├── features/         # Lazy-loaded page components per domain
│   ├── auth/         # login, register
│   ├── sales/        # main selling flow + full-screen mode
│   ├── cash/         # cash drawer management
│   ├── products/     # product catalog
│   ├── users/        # user management
│   ├── branches/     # branch management
│   ├── customers/    # customer list + detail
│   ├── company/      # company settings
│   ├── transport/    # transport management
│   └── dashboard/    # main dashboard
└── shared/
    ├── components/   # navbar, toast, onboarding-banner, sale-payment-inline
    └── services/     # toast.service
```

## Layout Architecture

- **`NavbarComponent` lives in `app.component.html`**, not in individual feature pages. It is rendered once at the root level above a `<div class="app-content">` wrapper that holds `<router-outlet>`.
- **Sidebar push effect:** `NavbarComponent` toggles `document.body.classList` with `sidebar-open`. Global `styles.css` applies `margin-left: 260px` to `.app-content` on that class. The sidebar itself is `position: fixed; top: 64px; left: 0`.
- **No icon library** — icons are inline SVG with `stroke`-based paths (Lucide-style, 24×24 viewBox).

## Key Conventions

- **Services** return `Observable<T>` (never Promises). Use `HttpClient` directly with `environment.apiUrl` as base.
- **Permission codes** are defined as constants in `src/app/core/models/permission.models.ts` — use those constants rather than raw strings.
- **Toast notifications** go through `ToastService.success()` / `ToastService.error()` (auto-dismiss 4 s).
- **Theming:** CSS custom properties in `src/styles.css`. Dark theme is default; `ThemeService` toggles a class on `<body>`.
- **Exports:** PDF via jsPDF, Excel via XLSX — both used inside feature components directly.
- **Onboarding:** `OnboardingService` controls a guided setup banner. `authGuard` checks onboarding status and may redirect before reaching the requested route.
