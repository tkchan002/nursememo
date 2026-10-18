# Nurse Memo — Technical Operations and Deployment Handover

**Audience:** Hospital infrastructure, application engineering, DBA, security, IAM, DevOps and service operations teams.  
**Source baseline:** Nurse Memo 1.0.0 (`package.json`), including Ward draft-history, form reset and revised status-bar code.  
**Documentation scope:** Architecture, dependencies, provisioning, builds, deployment, access control, operations and production-readiness gaps. This is **not** a clinical workflow guide.

> **Deployment classification — demonstration software, not a production-approved clinical system.** The supplied repository is configured for a Supabase-backed synthetic-data environment and contains demo-oriented authentication and account initialization. It has not undergone hospital security, privacy, clinical-safety, penetration, resilience or integration acceptance. Do not place real patient/staff information into this deployment until the receiving organization has assessed and remediated the gaps identified below.

## 1. Executive technical summary

Nurse Memo is a **multi-page, client-rendered web application** built with Vite and vanilla JavaScript/ES modules. It has **no Node.js application server at runtime**. The web server serves compiled files from `dist/`; authenticated reads/writes, persistence, account management and audit depend on a separate Supabase backend. A bundled browser-based document editor is built from a pinned external upstream repository and served under the same website origin as the main application.

| Layer | Current implementation | Where it runs |
| --- | --- | --- |
| Web UI | HTML/CSS/JavaScript, Vite 8.3.1, five HTML entry points | Browser; static files on HTTPS web server |
| API client | `@supabase/supabase-js` 2.117.2 | Browser |
| Authentication | Supabase Auth sessions; app-login RPC and Edge Function mediation | Supabase Auth, PostgreSQL, Edge Functions |
| Database | PostgreSQL tables, RLS policies, triggers and SECURITY DEFINER RPCs | Supabase PostgreSQL |
| Privileged APIs | `user-login`, `admin-users` | Supabase Edge Functions (Deno-compatible runtime) |
| Document output | `docx` 9.5.1, `docxtemplater` 3.69.3, `pizzip` 3.2.0 | Bundled web code/browser |
| Document editor | `ranuts/document` / ONLYOFFICE-derived upstream build | Browser; separately built static `/office/` assets |
| Current CI/CD | GitHub Actions and GitHub Pages | Build/deployment platform; replaceable |

**Important hosting distinction:** Moving `dist/` from GitHub Pages to a hospital-operated Nginx, Apache or IIS server makes only the **frontend** hospital-hosted. `config.js` currently targets a public Supabase project; it must be changed for the destination environment. Hospital-only/on-premise data hosting requires a separately designed Supabase-compatible backend deployment or application re-architecture. Neither is delivered by merely transferring this source ZIP.

### Runtime data flow

```text
Hospital browser -- HTTPS --> Hospital static web server
      |                        |-- /index.html, /ward.html, /patrol.html,
      |                        |   /maintenance.html, /print.html
      |                        `-- /office/  (same-origin editor + SDK/WASM)
      |
      `-- HTTPS --> Supabase-compatible API endpoints
                       |-- Auth: user sessions and refresh tokens
                       |-- REST/PostgREST: tables enforced by PostgreSQL RLS
                       |-- RPC: transactional saves, reporting and document data
                       `-- Edge Functions: user-login, admin-users
                                      |
                                      `-- service-role access: server-side only
```

This is not a traditional backend-rendered or intranet database-connected website. Browser-to-backend reachability, TLS, authentication trust and RLS remain necessary after relocation.

## 2. Repository and runtime contracts

| Path | Operational purpose |
| --- | --- |
| `index.html`, `login.js`, `pages/login-page.js` | Entry/login UI |
| `ward.html`, `ward.js`, `pages/ward-page.js` | Ward workspace, draft and submitted-report history |
| `patrol.html`, `patrol.js`, `pages/patrol-page.js` | Patrol Night workspace, memo documents, history and export |
| `maintenance.html`, `maintenance.js`, `pages/maintenance-page.js` | Configuration, account administration and templates |
| `print.html`, `print.js`, `services/print-job-service.js` | Same-origin print handoff via short-lived `sessionStorage` |
| `config.js`, `data/client.js` | Public Supabase endpoint/key, runtime mode, Supabase client |
| `services/auth-service.js`, `data/repositories/` | Authentication, client-side repositories and RPC requests |
| `domain/`, `components/`, `css/`, `core/` | Domain calculations, UI and shared browser infrastructure |
| `supabase/schema.sql`, `supabase/seed.sql` | Canonical schema and **synthetic** seed for a new environment |
| `supabase/EXISTING_PROJECT_LOGIN_UPGRADE.sql` | Targeted application-login migration for a compatible existing environment |
| `supabase/UPGRADE_WARD_DRAFT_HISTORY.sql` | Targeted metadata-only Ward draft-list RPC upgrade |
| `supabase/functions/{user-login,admin-users}/`, `supabase/functions/_shared/` | Edge Functions and shared code |
| `editor/patrol-ranuts.js` | Same-origin embedded-editor adapter |
| `documents/`, `scripts/patch-editor-embedded-downloads.mjs` | Document generation and pinned upstream export patch |
| `scripts/prepare-editor-site.mjs`, `scripts/verify-pages-editor.mjs` | Editor packaging, URL rewriting, converter checks, artifact validation |
| `vite.config.js`, `package.json`, `.github/workflows/` | Multi-page build, test and current CI/CD |
| `tests/` | Automated source/domain/integration-contract tests (not an end-to-end security certification) |

### Static site routes

The build produces `dist/index.html`, `dist/ward.html`, `dist/patrol.html`, `dist/maintenance.html` and `dist/print.html`. The fully packaged distribution additionally requires `dist/office/editor.html`, `dist/office/history.html`, `dist/office/sdkjs/`, `dist/office/web-apps/` and the other editor assets. **The `npm run build` output alone is not the complete application distribution.**

There is no application-side server router or required SPA fallback for the main pages. Serve actual files at their paths. The packaging script generates static redirect entry points for `/office/editor/` and `/office/history/`.

## 3. Deployment topology decisions

Choose and approve **one** target architecture before provisioning:

1. **Hospital static frontend + existing managed Supabase (least application change):** host the full `dist/` on the hospital's HTTPS web server; configure outbound client reachability to the approved Supabase project. Patient/staff/report data and login still leave the hospital infrastructure. Obtain privacy, vendor, data-residency, network and contractual approval first.
2. **Hospital static frontend + hospital-controlled managed Supabase project:** provision an isolated, appropriately governed Supabase environment; run a clean schema/provisioning workflow; deploy Edge Functions; configure the frontend and verify all permissions. Merely changing URL/key does not migrate data or users.
3. **Fully hospital-hosted stack:** plan, implement and operate PostgreSQL, Auth, PostgREST, Edge Functions, secrets, storage/configuration and supporting Supabase services behind an internal TLS endpoint, or redesign the application to use an approved hospital API/IAM stack. **This repository does not include a validated self-hosted Supabase topology, container orchestration, environment manifests, disaster-recovery procedure or migrations for that transformation.** The two Edge Functions and `@supabase/server` wrapper must be validated against the chosen runtime. Treat this option as a separate engineering project.

The supported frontend boundary is HTTPS static hosting. Backend portability and production security are **not** established simply by successful unit tests.

## 4. Build environment and external dependencies

### Toolchain

- Use **Node.js 24**, matching `.github/workflows/{quality,deploy-pages}.yml`.
- Install the application packages from `package.json` with `npm`; the supplied repository has **no committed `package-lock.json`**, so `npm ci` is not currently available and dependency resolution is not fully reproducible. Generate, inspect and commit an approved lockfile in the receiving organization's repository before production CI hardening.
- Building the complete document editor additionally requires **pnpm 11.4.0**, Git, network access to `github.com/ranuts/document`, its dependency registries and sufficient build disk/memory.
- The CI workflow pins the upstream `ranuts/document` Git revision to `beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0` unless GitHub variable `RANUTS_REF` overrides it. Do not silently track upstream `main`.
- The editor is **not vendored** in this source archive. Building only the frontend without the upstream editor produces a site with unavailable document-editing functionality.
- No runtime Node.js, pnpm or Git is needed on the production static-file server.

### Application source checks and base build

From the repository root, in a clean build workspace:

```sh
node --version    # use 24.x
npm install --no-audit --no-fund
DOCX_VERIFY_GENERATION=1 npm run verify
npm run build
```

`npm run verify` runs `node scripts/check.mjs`, the relative import checker and `node --test --test-concurrency=4 ./tests/*.test.mjs`. The quality workflow runs these tests and Vite build but **does not** build the upstream office editor; the deploy workflow does.

### Full document-editor build and packaging

Mirror the steps in `.github/workflows/deploy-pages.yml` in a controlled build runner. For example:

```sh
mkdir -p .upstream
git clone https://github.com/ranuts/document.git .upstream/ranuts-document
git -C .upstream/ranuts-document checkout beb7e2fd6c2eada4c4ff21e94ac37d5c39a79fc0

# Provision pnpm 11.4.0 in the build environment, then:
(cd .upstream/ranuts-document && pnpm install --frozen-lockfile)
node scripts/patch-editor-embedded-downloads.mjs
(cd .upstream/ranuts-document && pnpm run build)

# Root deployment: leave PAGES_BASE_PATH unset (outside GitHub Actions),
# or set it explicitly to '/'. For a subdirectory use '/nurse-memo/'.
PAGES_BASE_PATH=/ RANUTS_REVISION=$(git -C .upstream/ranuts-document rev-parse HEAD) \
  node scripts/prepare-editor-site.mjs
node scripts/verify-pages-editor.mjs
```

The upstream patch is deliberately fail-closed: if the pinned vendor source structure changes, the build stops instead of delivering an unverified integration. The packaging script rewrites upstream root-relative static assets to the configured deployment prefix, creates static editor/history routing stubs, and prepares the `x2t` WebAssembly converter with `.wasm.gz` streaming plus a raw `.wasm` fallback. Do not bypass these scripts or copy unmodified upstream files into `/office/`.

For a **subpath** deployment, ensure the actual web mount, `PAGES_BASE_PATH`, frontend files and `/office/` assets all agree. The frontend's Vite `base: './'` supports relative assets; the editor packaging needs its **absolute public path**. In GitHub Actions, leaving `PAGES_BASE_PATH` unset derives the repository project path from `GITHUB_REPOSITORY`, which is **not** suitable when building for an unrelated hospital host. Set the variable explicitly in the hospital build pipeline.

The output to promote is the **entire `dist/` directory**. Validate the artifact before deployment; do not use `npm run dev` or expose the Vite development server as a production service.

## 5. Static web-server deployment

### Baseline requirements

- HTTPS with a trusted certificate, approved hostname, DNS and time synchronization.
- Serve `dist/` as the web root (or an approved prefix); preserve all filenames, directory structure, MIME types, SDK assets and large WASM files.
- Respond to static GET/HEAD requests correctly, including `index.html`, each other HTML entry point, nested `/office/` paths and generated `/office/editor/index.html` and `/office/history/index.html`.
- Configure `application/wasm` for `.wasm`. The generated `.wasm.gz` is a gzip **file** that is decompressed by application JavaScript; do **not** force `Content-Encoding: gzip` for that asset without verifying the loader, MIME handling and content bytes.
- Browser access must permit ECMAScript modules, WebAssembly, workers/iframes, same-origin `postMessage`, browser `sessionStorage`/local storage, document downloads and printing.
- Ensure `Content-Security-Policy`, cross-origin isolation, iframe and cache-control policies are validated against the editor; do not add blanket `frame-ancestors 'none'` or incompatible CSP directives without testing the embedded editor. Its iframe is intentionally same-origin.
- Avoid caching mutable HTML indefinitely. Deploy immutable assets with versioned URLs where possible and invalidate caches on releases.

### Example Nginx static vhost (root-path deployment)

This is a **starting configuration**, not a ready-made hospital firewall, TLS or reverse-proxy standard. Integrate with centrally managed TLS, headers, audit logging and change control:

```nginx
server {
    listen 443 ssl;
    server_name nurse-memo.internal.example;
    # SSL certificate/key and corporate TLS policy: supplied by infrastructure team.

    root /srv/nurse-memo/releases/current;
    index index.html;
    include /etc/nginx/mime.types;
    # Verify this MIME map includes: application/wasm  wasm;

    location / {
        try_files $uri $uri/ =404;
    }

    # HTML should be revalidated after deployments.
    location ~* \.html$ {
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }

    location = /office/sdkjs/common/wasm/x2t/x2t.wasm.gz {
        default_type application/gzip;
        try_files $uri =404;
    }
}
```

Do not blindly deploy this sample without the organization's security baseline. Configure `application/wasm` in the **existing complete** Nginx MIME map if it is absent; do not replace the map with a single-extension `types` block, which can break JavaScript module MIME responses. For IIS/Apache, implement equivalent static routing, MIME and caching configuration. A root-path deployment is simpler than a subdirectory mount; if using a reverse-proxy prefix, re-run the editor packaging with that prefix and test deep URLs and native export.

### Minimal artifact smoke checks

```sh
curl -I https://nurse-memo.internal.example/index.html
curl -I https://nurse-memo.internal.example/ward.html
curl -I https://nurse-memo.internal.example/office/editor.html
curl -I https://nurse-memo.internal.example/office/web-apps/apps/documenteditor/main/index.html
curl -I https://nurse-memo.internal.example/office/sdkjs/common/wasm/x2t/x2t.wasm.gz
curl -fsS https://nurse-memo.internal.example/office/nurse-memo-editor-build.json
```

Expect successful HTTP responses for all files, correct MIME/content and a JSON manifest whose `officeBase` matches the actual server path. Confirm the editor **loads a DOCX interactively**; an HTTP 200 on `editor.html` alone is not an adequate editor test.

## 6. Public runtime configuration and network paths

`config.js` contains **build-time public browser configuration**:

```js
SUPABASE_URL: 'https://<approved-backend-host>',
SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_<approved-publishable-key>',
FORCE_DEMO_MODE: false,
```

These are examples, not literal replacement values. The actual `config.js` currently contains an existing public demo project's URL and publishable key. **Replace the values for the target environment before building the hospital artifact** and verify that the compiled output points only to the authorized backend. `resolveRuntimeConfig()` requires an HTTPS URL and a modern `sb_publishable_...` key. It fails closed when configuration is invalid. `FORCE_DEMO_MODE=true` switches to local synthetic demonstration state and must not be enabled on the hospital production deployment.

The Supabase **publishable** key is intentionally public and is included in browser bundles; it is **not an authorization boundary**. Authorization must be enforced by RLS, SQL RPC checks, Auth and Edge Functions. Never include `sb_secret_*`, the legacy service-role JWT, database credentials, OTPs, private certificates or operator passwords in source, build outputs, web-server environment pages or client assets.

The browser must be able to reach the chosen backend over TLS, including its Auth, REST/RPC and Functions endpoints. Use the approved API hostname, DNS, TLS trust, firewall egress and (where applicable) outbound proxy. The server-side Edge Functions must independently reach the database/Auth APIs and obtain their privileged secrets from the backend's secret store. The current implementation does not have a hospital backend proxy/BFF to conceal external data transfer.

If hosting the frontend at a new origin, validate Auth redirects/session persistence, CORS behavior, editor iframe origin matching, download behavior and restrictive network policies. Do not assume that merely pointing DNS at the hospital web server completes backend integration.

## 7. Database provisioning, SQL lifecycle and data boundaries

### New / empty backend

1. Provision an **isolated** Supabase-compatible project/environment and confirm its Auth, SQL, PostgREST, Edge Function, key-management, logging and backup services are functioning.
2. Run `supabase/schema.sql` **once, only against the intended empty environment**. It establishes tables, policies, triggers and application RPCs. Review the SQL and take a baseline backup/snapshot before execution; it is not a generic upgrade tool.
3. **Do not run `supabase/seed.sql` wholesale for hospital production.** It inserts synthetic Wards, capacities, form items and demonstration staff. However, the **application requires a valid published `form_versions` row and active `report_items` configuration**, plus approved ward/reference records, before saving reports can work. Derive a reviewed, environment-specific baseline of those configuration rows (including valid date-effective ranges and Ward capacities) without copying demonstration identities or staff. For test environments, deliberately seed synthetic reference data as appropriate.
4. Provision Supabase Auth identities, `public.user_access` role/ward mappings and app-login credentials through controlled administrative operations. On a fresh project the shipped account bootstrap script is **test/demo tooling**, not an enterprise IAM provisioning solution.
5. Deploy both Edge Functions and validate all required RPC grants and RLS identities before releasing the frontend.

### Existing backend

**Do not run `supabase/schema.sql` or `supabase/seed.sql` over an existing live database.** Existing deployments need a schema-diff review and ordered, backed-up, transactional migration plan. The package is **not** a complete migration framework for arbitrary historical releases.

Two **targeted** SQL upgrades are included for environments already on the compatible preceding schema:

| SQL file | Purpose | Notes |
| --- | --- | --- |
| `supabase/EXISTING_PROJECT_LOGIN_UPGRADE.sql` | Adds application login credential hashes and corresponding privileged login/account RPCs | Contains **demo default-password initialization** for existing user rows: passwords equal lowercase login IDs if not already initialized. **Never apply blindly to production identities.** Design an approved replacement IAM process. |
| `supabase/UPGRADE_WARD_DRAFT_HISTORY.sql` | Adds `list_ward_cycle_drafts(uuid,integer)` | Authenticated, ward-scoped, metadata-only draft listing; leaves report payloads separate. |

The canonical current `schema.sql` already declares these features; do not automatically reapply upgrades following a fresh schema provision. Record applied SQL versions externally (or introduce a migration ledger) because the project does not currently use a managed schema-migration history directory.

### Main persistent entities

| Entity | Key data / operational notes |
| --- | --- |
| `auth.users`, `public.user_access` | Supabase Auth identities mapped to app role, ward and active state |
| `public.app_login_credentials` | Salted password hashes and lockout state; service-role access only |
| `public.wards`, `ward_operating_periods`, `ward_capacity_history`, `ward_staff` | Reference configuration and date-effective attributes |
| `public.form_versions`, `report_items` | Date-effective field/configuration definitions |
| `public.ward_cycle_drafts` | Mutable, ward/date/type-scoped drafts with revision and timestamps |
| `public.ward_reports`, `ward_cycle_revisions` | Submitted records and revision history |
| `public.patrol_memos`, `patrol_memo_revisions`, `patrol_memo_recovery_snapshots` | Memo state, revisions and recovery points |
| `public.patrol_memo_docx_documents` | DOCX persistence managed through SQL RPCs |
| `public.night_memo_visual_templates`, `night_roster_snapshots` | Document-template and snapshot records |
| `public.audit_log` | Application/database audit records (not a substitute for infrastructure/security logs) |
| `public.demo_data_batches`, `demo_data_reports` | Synthetic-data tooling; disable/segregate for a governed deployment |

Application SQL operations include optimistic revision checks and conflict errors (`REPORT_CONFLICT`) to reduce silent concurrent overwrites. `list_ward_cycle_drafts` returns metadata, not draft report bodies. PostgreSQL RLS is enabled for application tables, with SECURITY DEFINER functions for authorized transactional tasks; verify **function execute grants** and role checks on the target platform. Hospital IAM roles are not automatically mapped to application roles.

**Timezone:** the browser reporting-date logic uses `Asia/Hong_Kong` (`core/dates.js`). Keep database timestamps in proper timezone-aware types; verify reporting-date semantics, server time synchronization and date boundaries in integration testing.

## 8. Authentication, Edge Functions and secrets

### Current authentication model

- The browser posts account ID/password to `user-login` (no pre-existing Supabase user JWT).
- The function uses a backend-only service-role client to invoke `app_login_verify`, looks up the linked Auth identity, creates/consumes a magic-link token server-side, and returns a Supabase session to the browser.
- The browser stores/refreshed a normal Supabase Auth session through `@supabase/supabase-js`, then authorizes page access using the `user_access` mapping. Database RLS and secured RPCs must enforce authorization independently of UI checks.
- `admin-users` requires a valid user JWT and separately verifies an active `maintenance` role before using privileged account APIs. Its shared modules reside in `supabase/functions/_shared/`.

### Edge Function deployment contract

`supabase/config.toml` specifies:

```toml
[functions.admin-users]
verify_jwt = true

[functions.user-login]
verify_jwt = false
```

Deploy source **with its `_shared` dependencies**, the appropriate compatible Supabase runtime, backend environment and secrets. The following is an example for an approved Supabase-hosted environment (execute in a trusted operator session, never from a public browser or production web host):

```sh
npx supabase@latest login
npx supabase@latest functions deploy admin-users --project-ref PROJECT_REF --use-api
npx supabase@latest functions deploy user-login --project-ref PROJECT_REF --use-api --no-verify-jwt
```

Alternatively, use the Supabase Dashboard only if the organization can deploy the same full source and shared imports reproducibly, configure JWT verification independently for each function, and archive the effective deployed source/revision. These functions are **not** included in the Vite `dist/` artifact. A frontend release does not deploy them.

The login function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the **server runtime**. The privileged key must never be supplied to `config.js`. The `admin-users` function relies on Supabase's server wrapper (`npm:@supabase/server@1`) for authenticated and privileged clients. Validate library/runtime compatibility on any self-hosted implementation.

### Security implications requiring formal review

- Current app passwords are separate from (and **do not revoke**) the underlying Supabase Auth password/session mechanism. Existing Auth credentials can still authenticate directly if otherwise permitted. IAM integration and account disablement must address both paths.
- The existing SQL accepts **two-character passwords**, and the existing-account upgrade initializes weak predictable demo passwords. The five-attempt/five-minute account lockout is insufficient as a comprehensive hospital authentication control. Implement institutional password, MFA, identity-lifecycle and session requirements before production use.
- `user-login` currently responds with permissive `Access-Control-Allow-Origin: *` and is unauthenticated at the API gateway. Threat-model credential stuffing, endpoint abuse, global rate limiting, monitoring, abuse protection and origin policy rather than relying on the SQL per-account lockout alone.
- Session tokens persist in the browser under Supabase client defaults. Review workstation/shared-device logout, browser-profile protection, idle timeouts, refresh-token revocation, endpoint management and XSS/CSP risks.
- Review all RLS policies and SECURITY DEFINER functions for authorization, owner privileges and search paths; validate prohibited cross-ward reads/writes with an actual backend, not source-pattern tests alone.
- Review document content retention, client-side print buffers, audit/event attribution, access logs and backup retention against the organization's information governance policy.
- Disable/demo-isolate all synthetic-data generation and test-account facilities before handling regulated information.

## 9. Release, validation and rollback

### Current CI behavior

- `.github/workflows/quality.yml`: PR/manual checks using Node 24, `npm run verify`, then `npm run build`.
- `.github/workflows/deploy-pages.yml`: push to `main`/manual; verification, application build, pinned `ranuts/document` checkout, pnpm build, native-export patch, packaging checks, then **GitHub Pages** publish.
- These are reference pipelines, **not** an on-prem hospital deployment implementation. Replace the GitHub Pages publish job with a controlled artifact registry, checksum/signing step, environment promotion, security scan, approval and atomic file deployment. Preserve the same build/verification stages.
- The source ZIP contains no npm lockfile and no precompiled upstream editor. Pin dependencies and archive the exact compiled artifact and third-party notices before change-controlled hospital deployments.

### Required acceptance tests (against the target backend)

1. Confirm the runtime URL/key point to the approved environment; `FORCE_DEMO_MODE=false`; no service credentials are present in the published JavaScript/assets.
2. Confirm both Edge Functions are deployed and correctly gated: `user-login` before login; `admin-users` denied without JWT or Maintenance role.
3. Test valid/invalid/disabled accounts, account role changes, token refresh/expiry, sign-out, failed session creation and rate limiting.
4. Test RLS isolation between two different Ward accounts; verify unauthorized reads, SQL RPC calls and mutation requests are denied server-side.
5. Test a draft save, reload, draft History retrieval, resumed draft, submission, revision conflict and separation of draft versus submitted records.
6. Test Patrol Night memo creation, revision/recovery, document editor cold start, editing, save, native DOCX/PDF export, preview and printing in supported browsers.
7. Test Ward/Maintenance and all five HTML entry points; validate that PDF/print buffers work within browser-storage policies.
8. Test the same functions through the hospital ingress (CSP, proxy, TLS, egress, DNS and session policies), not solely on local development machines.
9. Exercise backup restoration in a disposable environment and verify report and account referential integrity; document approved RPO/RTO, retention and restore ownership.
10. Run dependency/license/SBOM analysis, SAST/DAST, penetration assessment, hospital security review and privacy/clinical risk sign-off before allowing sensitive data.

**Passing the repository unit tests and static build does not satisfy these acceptance criteria.** There is no supplied hospital UAT certificate, load-test evidence, DR validation or security attestation.

### Rollback strategy

- Publish versioned, immutable **full frontend/editor** artifacts. Promote a symlink or directory atomically; revert to the previous compatible complete `dist/` if the frontend fails.
- **Do not automatically roll back database schema** with an older frontend. Check backward compatibility for modified SQL functions/tables; use a separately approved database migration/restore plan.
- Treat Edge Function versions as part of a coordinated release; older client bundles may depend on newer RPCs and vice versa.
- Maintain encrypted database/Auth backups, account credential continuity and a restore-tested recovery path. Restoring only the web server cannot recover reports, Auth users or SQL state.
- Ensure browser and edge caches cannot serve mixed editor and application release versions after rollback.

## 10. Operations and observability

An operational deployment should provide, at minimum:

- HTTPS availability and static asset integrity monitoring; `/office/` editor and WASM response checks; TLS certificate expiry and DNS monitoring.
- Supabase/PostgreSQL availability, connection, query/locking, storage, backup/restore and disk-capacity monitoring. Include RPC failure counts and database migration drift.
- Supabase Auth/Edge Function failure, 401/403/429/5xx rates, authentication anomalies, token errors, login latency and audit anomaly monitoring, with privacy-preserving log redaction.
- Frontend JavaScript exception telemetry (with strict payload scrubbing), editor load failures and browser-specific export failures.
- Retention limits for application logs, database audit tables, browser print artifacts and generated documents; named owners for incident response and credential/key rotation.
- Scheduled update review for Node build images, application packages, pnpm, the pinned editor revision, Deno/Supabase libraries and security advisories.

No centralized telemetry, SIEM forwarding, metrics dashboard, application health API, automated on-prem backups, high-availability blueprint or on-prem deployment manifests are supplied by this repository. These must be added as part of service onboarding.

## 11. Third-party licensing and distribution

The editor integration builds `ranuts/document`, an **ONLYOFFICE-derived AGPL-3.0** codebase, and publishes the upstream `LICENSE` and `NOTICE` alongside the `/office/` bundle. The institution's legal/open-source governance team must review derivative-work, source-availability, network-use and redistribution obligations, including the local export patch and any future changes. Preserve original licenses/notices in artifacts; do not assume intranet-only hosting removes AGPL obligations. Review all npm/pnpm transitive dependencies and generate an SBOM for the approved release.

## 12. Known gaps and handover requirements

The following are **not implemented or not established** by this source delivery:

- Hospital SSO/LDAP/AD/MFA and identity lifecycle integration.
- Complete hospital-on-prem Supabase deployment and validation.
- Approved use with identifiable patient records and clinical safety certification.
- Managed versioned database migrations for upgrades from any arbitrary historical schema.
- Production-grade password policies, abuse prevention and centrally enforced session governance.
- Reproducible npm lockfile and attested, signed full-site artifacts.
- Nginx/IIS/Apache configs validated under the hospital's actual ingress, CSP and network security controls.
- Production recovery objectives, backup/restore automation, performance/load testing and monitoring runbooks.
- Security scans, third-party legal clearance and supported-browser acceptance for the embedded editor.

### Receiving-team deployment record (complete before acceptance)

| Item | Record/owner |
| --- | --- |
| Source revision and signed build artifact digest | To be recorded by DevOps |
| Node/npm and pnpm versions; upstream editor Git SHA | To be recorded by build engineering |
| Approved web FQDN, URL mount path, TLS/proxy configuration | Infrastructure |
| Backend project/cluster, data residency and egress approval | Architecture/privacy |
| Auth provider, session/IAM integration and emergency admin procedure | IAM/security |
| Secrets owner, Edge Function revisions, deployment method | Platform engineering |
| SQL schema baseline, applied migrations, database backup/restore | DBA |
| Monitoring, alert owners, log retention, incident escalation | Operations/SOC |
| Security, licensing, accessibility and clinical data-use approvals | Relevant governance owners |
| Verified acceptance, rollback and DR test reports | Application owner / change board |

**Primary engineering references:** `package.json`, `vite.config.js`, `.github/workflows/`, `config.js`, `data/client.js`, `supabase/schema.sql`, `supabase/functions/`, `scripts/prepare-editor-site.mjs`, `scripts/verify-pages-editor.mjs`. These are the implementation contracts; reconcile this README with code whenever a release changes its hosting architecture.
