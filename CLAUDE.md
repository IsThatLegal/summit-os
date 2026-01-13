# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SummitOS is a comprehensive property management system for automated gate access control, tenant management, and payment processing. It's production-ready with enterprise-grade security features including JWT authentication, role-based access control, and Row Level Security policies.

**Tech Stack**: Next.js 16 (App Router), TypeScript, Supabase (PostgreSQL), Stripe, LangGraph AI agents, Playwright (E2E), Jest (Integration)

## Development Commands

### Running the Application
```bash
npm run dev                    # Start development server (requires .env.local)
npm run build                  # Build for production
npm start                      # Start production server
```

### Testing
```bash
# Integration Tests (requires dev server running on port 3000)
npm run dev                    # Start dev server in one terminal
npm test                       # Run Jest integration tests in another terminal

# E2E Tests (auto-starts dev server)
npm run test:e2e               # Run Playwright E2E tests (all browsers)
npx playwright test            # Alternative E2E command
npx playwright test --ui       # Run E2E tests in UI mode
npx playwright test --project=chromium  # Run E2E tests in single browser

# Other Tests
npm run test:agent             # Test the AI Enforcer agent (tsx scripts/test-enforcer.ts)
```

**📖 See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive testing instructions and troubleshooting.**

### Linting & Code Quality
```bash
npm run lint                   # Run ESLint
```

### Cleanup & Deployment
```bash
npm run cleanup:tests          # Clean up test data (./scripts/cleanup-tests.sh)
npm run cleanup:nuke           # Nuclear cleanup via API (DELETE /api/cleanup/scorched)
npm run deploy                 # Deploy to Vercel production
```

## Architecture

### Core System Flow

**Gate Access Control** is the central feature:
1. Gate hardware/simulator sends gate access code to `POST /api/gate/access`
2. System queries `tenants` table by `gate_access_code`
3. Access granted if: `current_balance <= 0` AND `is_locked_out = false`
4. All access attempts logged to `gate_logs` table with actions: `entry_granted` or `entry_denied`

**Payment Processing** automatically updates access:
- Stripe payments update tenant `current_balance` (stored in cents)
- Positive balance = locked out, zero/negative = access granted
- Transactions logged in `transactions` table via database trigger

### Database Schema

**Core Tables** (see `supabase/migrations/`):
- `tenants`: Tenant records with balance, gate codes, lockout status, license plates
- `units`: Storage unit inventory with pricing, status, dimensions, door types
- `gate_logs`: All gate access attempts with timestamps
- `transactions`: Financial transaction history
- `billing_logs`: Automated billing records
- `user_profiles`: Authentication and RBAC (admin, manager, tenant roles)
- `payment_methods`: Stored payment methods per tenant

**Key Relationships**:
- Tenants can occupy multiple units (many-to-many via `tenant_units`)
- Transactions automatically update tenant balances via trigger (0002 migration)
- Row Level Security (RLS) policies enforce data isolation by role (0006 migration)

### API Architecture

**Authentication Patterns**:
- Most routes: JWT via `withAuth()` middleware from `lib/auth.ts`
- Gate endpoints (`/api/gate/*`): Unauthenticated (rate-limited for hardware integration)
- Admin routes: Role-based access control (admin/manager roles required)

**Security Layers**:
1. Input validation using Zod schemas on all API routes
2. Rate limiting via `lib/rateLimit.ts` (different limits per endpoint type)
3. Security headers added via `addSecurityHeaders()` from `lib/auth.ts`
4. Row Level Security at database level

### Key Integration: SiteLink Web Edition

`lib/sitelink-integration.ts` provides two-way sync:
- **Pull**: Import units, tenants, transactions from SiteLink (`syncUnitsFromSiteLink`, `syncTenantsFromSiteLink`, `syncTransactionsFromSiteLink`)
- **Push**: Export updates to SiteLink (`pushUnitToSiteLink`, `pushTenantToSiteLink`, `pushPaymentToSiteLink`)
- **Real-time**: Check unit availability (`checkRealTimeAvailability`)
- Enabled via environment variables: `SITELINK_API_URL`, `SITELINK_USERNAME`, `SITELINK_PASSWORD`

### AI Agent System

**The Enforcer** (`lib/agents/enforcer/graph.ts`):
- Collections agent that monitors tenant balances
- Currently simplified implementation (LangGraph integration in progress)
- Fetches tenant data and drafts collection messages
- Human-in-the-loop approval system via `components/enforcer-modal.tsx`
- Test via: `npm run test:agent`

**Future Agents**:
- The Closer: Sales and lead conversion
- The Steward: Maintenance coordination

### Hardware Integration

**Python Scripts** (`scripts/`):
- `gate_controller.py`: IoT relay control for physical gates, offline failover
- `camera_simulator.py`: License plate recognition testing

**API Integration**:
- `POST /api/gate/access`: Access control decisions
- `POST /api/gate/identify`: License plate → tenant lookup

### Frontend Structure

**Pages** (`app/`):
- `/dashboard`: Main management interface (`components/dashboard-page.tsx`)
- `/gate-simulator`: Gate hardware testing interface
- `/move-in`: Multi-step wizard for new tenant onboarding (`components/move-in/MoveInWizard.tsx`)
- `/unit-map`: Visual unit map builder (`components/unit-map/UnitMapBuilder.tsx`)
- `/tenant/dashboard`: Tenant self-service portal
- `/tenant/payments`: Tenant payment interface
- `/auth/login`: Authentication page

**Theme System**:
- Dark mode support via `components/theme-provider.tsx`
- Uses Tailwind CSS classes for theming

## Environment Setup

Required variables in `.env.local` (see `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
```

Optional SiteLink integration:
```bash
SITELINK_API_URL=https://api.sitelink.com
SITELINK_USERNAME=your_username
SITELINK_PASSWORD=your_password
SITELINK_SITE_ID=your_site_id
SITELINK_CORPORATE_CODE=your_corporate_code
```

## Testing Strategy

**Integration Tests** (`tests/integration/`):
- Use Jest with `ts-jest` for TypeScript
- Test API routes directly without UI
- Configured for ESM modules
- Run against local Supabase instance
- **Requires dev server running**: Start `npm run dev` before running `npm test`

**Test Coverage** includes:
- `auth.test.ts`: Authentication validation, security headers, credential requirements
- `tenant.test.ts`: Tenant CRUD operations, gate code uniqueness, balance handling
- `payments.test.ts`: Charge processing, check/cash payments, balance calculations, transaction logging
- `units.test.ts`: Unit CRUD operations, status management, pricing updates, door type validation
- `gate-integration.test.ts`: Gate access control logic and hardware integration

**Test Utilities** (`tests/helpers/testUtils.ts`):
- `generateTestId()`: Creates unique test identifiers with `TEST_` prefix
- `createTestTenant(overrides)`: Generate test tenant records
- `createTestUnit(overrides)`: Generate test unit records
- `deleteTestTenant(id)` / `deleteTestUnit(id)`: Individual cleanup
- `cleanupAllTestData()`: Removes all test data (runs in beforeAll/afterAll hooks)
- `makeAuthenticatedRequest()`: Helper for authenticated API calls
- `waitFor()`: Async operation polling with timeout

**Test Data Management**:
- All test data uses `TEST_` prefix for easy identification and cleanup
- Tests clean up after themselves using `beforeAll`/`afterAll` hooks
- Use `cleanupAllTestData()` to prevent test pollution between runs
- Cleanup script available: `npm run cleanup:tests`

**E2E Tests** (`e2e/`):
- Playwright across Chromium, Firefox, Safari
- Full user workflows including payment processing
- Global setup runs cleanup via `e2e/global-setup.ts`
- Dev server auto-starts during test runs

## Important Implementation Notes

### Next.js 15+ Async API Routes
API routes must handle async params:
```typescript
// Correct pattern for Next.js 15+
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  // ...
}
```

### Balance Storage
- All balances stored in **cents** (integer) to avoid floating-point issues
- Convert to dollars only for display: `(balance / 100).toFixed(2)`
- Stripe also uses cents natively

### Supabase Client
Use singleton pattern from `lib/supabaseClient.ts`:
```typescript
import { getSupabase } from '@/lib/supabaseClient';
const supabase = getSupabase();
```

### Path Aliases
Use `@/*` for absolute imports from project root (configured in `tsconfig.json`)

### Gate Access Logic
Critical business rule: Access granted when `current_balance <= 0` AND `is_locked_out = false`
- Zero balance = paid in full = access granted
- Positive balance = owes money = access denied
- `is_locked_out` flag allows manual override regardless of balance
