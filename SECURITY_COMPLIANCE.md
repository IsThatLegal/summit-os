# Security & Compliance Implementation Guide

**Last Updated:** 2026-01-14
**Status:** Production Ready
**Compliance:** GDPR, SOX, PCI-DSS (via Stripe)

---

## Table of Contents

1. [Multi-Factor Authentication (MFA)](#multi-factor-authentication)
2. [Audit Logging](#audit-logging)
3. [GDPR Compliance](#gdpr-compliance)
4. [Production Monitoring](#production-monitoring)
5. [Security Best Practices](#security-best-practices)
6. [API Reference](#api-reference)
7. [Incident Response](#incident-response)

---

## Multi-Factor Authentication (MFA)

### Overview

Summit OS implements comprehensive MFA for admin accounts to prevent unauthorized access. MFA is **required** for all admin roles and optional for tenants.

### Supported Methods

1. **SMS-based OTP** (One-Time Password via text message)
2. **TOTP** (Time-based One-Time Password via authenticator apps)
3. **Backup Codes** (8 one-time use recovery codes)

### MFA Enforcement Policy

| Role | MFA Required | Grace Period |
|------|--------------|--------------|
| SUPER_ADMIN | Yes | 7 days |
| PROPERTY_ADMIN | Yes | 14 days |
| FINANCE_ADMIN | Yes | 14 days |
| AUDITOR | Yes | 30 days |
| GATE_OPERATOR | No | N/A |
| TENANT | No | N/A |

### API Endpoints

#### Enroll in MFA
```http
POST /api/mfa/enroll
Authorization: Bearer <token>
Content-Type: application/json

{
  "method_type": "totp|sms|backup_codes",
  "phone_number": "+15551234567" // Required for SMS
}
```

**Response (TOTP):**
```json
{
  "success": true,
  "message": "TOTP secret generated",
  "method_id": "uuid",
  "secret": "ABCD1234...",
  "qr_code_url": "otpauth://totp/...",
  "manual_entry_key": "ABCD1234...",
  "note": "Scan QR code with authenticator app"
}
```

#### Verify MFA Code
```http
POST /api/mfa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "method_id": "uuid",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA verification successful",
  "method_verified": true,
  "remaining_backup_codes": 8
}
```

#### Check MFA Status
```http
GET /api/mfa/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "mfa_enabled": true,
  "mfa_required": true,
  "methods": [
    {
      "id": "uuid",
      "method_type": "totp",
      "is_verified": true,
      "is_active": true,
      "last_used_at": "2026-01-14T10:00:00Z"
    }
  ],
  "backup_codes_remaining": 8,
  "enforcement_policy": {
    "required": true,
    "grace_period_days": 7,
    "grace_period_end": "2026-01-21T10:00:00Z",
    "is_in_grace_period": false
  }
}
```

#### Disable MFA Method
```http
POST /api/mfa/disable
Authorization: Bearer <token>
Content-Type: application/json

{
  "method_id": "uuid",
  "confirmation_code": "123456" // Requires MFA verification
}
```

### Login Flow with MFA

1. User enters email/password → `/api/auth/login`
2. Server responds with:
   ```json
   {
     "token": "jwt_token",
     "user": { ... },
     "mfa": {
       "required": true,
       "enabled": true,
       "needs_setup": false,
       "needs_verification": true
     }
   }
   ```
3. If `needs_verification: true`, prompt user for MFA code
4. User enters code → `/api/mfa/verify`
5. Grant full access after successful verification

### Security Features

- **Rate Limiting:** 5 failed MFA attempts in 15 minutes triggers security alert
- **Audit Logging:** All MFA events logged (enabled, disabled, verified, failed)
- **Backup Codes:** One-time use, expire after 90 days
- **Account Lockout Prevention:** Cannot disable last MFA method if required for role
- **Session Security:** MFA verification required per session

---

## Audit Logging

### Overview

All sensitive operations are automatically logged to an immutable audit trail for compliance and forensics.

### What Gets Logged

1. **Database Changes** (via triggers):
   - Tenant modifications (INSERT, UPDATE, DELETE)
   - Unit modifications
   - Transaction records
   - Payment methods
   - User profile changes

2. **Authentication Events**:
   - Login attempts (success/failure)
   - Password resets
   - MFA enabled/disabled
   - Account lockouts
   - Session expiration

3. **Security Events**:
   - Multiple failed logins
   - Unusual locations
   - Suspicious payments
   - Privilege escalation attempts
   - Mass data exports

### Audit Log Structure

```sql
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    user_id uuid REFERENCES auth.users(id),
    old_data JSONB, -- Previous record state
    new_data JSONB, -- New record state
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoints

#### Query Audit Logs
```http
GET /api/audit/logs?table_name=tenants&operation=UPDATE&start_date=2026-01-01T00:00:00Z&limit=100
Authorization: Bearer <token>
```

**Required Role:** SUPER_ADMIN or AUDITOR

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "table_name": "tenants",
      "operation": "UPDATE",
      "user_id": "uuid",
      "old_data": { "current_balance": 5000 },
      "new_data": { "current_balance": 0 },
      "ip_address": "192.168.1.1",
      "timestamp": "2026-01-14T10:00:00Z",
      "user_profiles": {
        "email": "admin@example.com",
        "role": "FINANCE_ADMIN"
      }
    }
  ],
  "pagination": {
    "total": 1543,
    "limit": 100,
    "offset": 0,
    "has_more": true
  }
}
```

#### Query Authentication Events
```http
GET /api/audit/auth-events?event_type=login_failed&start_date=2026-01-14T00:00:00Z
Authorization: Bearer <token>
```

**Required Role:** SUPER_ADMIN or AUDITOR

### Data Retention

- **Audit Logs:** 7 years (financial compliance)
- **Auth Events:** 1 year (security compliance)
- **Security Alerts:** Indefinite (until resolved)

---

## GDPR Compliance

### Overview

Summit OS implements GDPR-compliant data handling for EU users, including right to access, erasure, rectification, portability, and restriction.

### Data Subject Rights

#### 1. Right to Access
Users can request a copy of all their personal data.

```http
POST /api/gdpr/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_type": "access",
  "notes": "Optional notes"
}
```

**Processing Time:** 30 days

#### 2. Right to Erasure ("Right to be Forgotten")
Users can request deletion of their personal data.

```http
POST /api/gdpr/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_type": "erasure"
}
```

**What Gets Deleted:**
- Personal identifiers (name, email, phone) → Anonymized
- Payment methods → Soft deleted
- User account → Disabled

**What Gets Kept:**
- Financial transaction records (7 years for legal compliance)
- Audit logs (immutable for compliance)
- Anonymized aggregate statistics

**Processing Time:** 60 days

#### 3. Right to Rectification
Users can request correction of inaccurate data.

```http
POST /api/gdpr/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_type": "rectification",
  "notes": "Update email address from old@example.com to new@example.com"
}
```

#### 4. Right to Data Portability
Users can request their data in a machine-readable format (JSON).

```http
POST /api/gdpr/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_type": "portability"
}
```

#### 5. Right to Restriction
Users can request temporary suspension of data processing.

```http
POST /api/gdpr/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "request_type": "restriction",
  "notes": "Dispute accuracy of current balance"
}
```

### Admin Processing (SUPER_ADMIN / PROPERTY_ADMIN)

#### Approve/Reject/Complete Request
```http
POST /api/gdpr/process
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "request_id": "uuid",
  "action": "complete",
  "data_export_url": "https://storage.example.com/exports/user_data.json", // For access/portability
  "rejection_reason": "Request does not apply" // For reject action
}
```

### Data Retention Policies

| Data Type | Retention Period | Deletion Strategy |
|-----------|------------------|-------------------|
| Audit Logs | 7 years | Archive |
| Transactions | 7 years | Archive |
| Auth Events | 1 year | Archive |
| Gate Logs | 2 years | Archive |
| MFA Attempts | 90 days | Hard Delete |
| Billing Logs | 7 years | Archive |
| Payment Methods | 7 years after tenant leaves | Soft Delete |
| Tenant Records | 7 years after lease end | Soft Delete |

### Automated Cleanup

A scheduled job runs daily to clean up old data:

```sql
SELECT * FROM cleanup_old_data();
```

**Schedule:** Daily at 2:00 AM UTC (via Supabase Edge Function or cron)

---

## Production Monitoring

### Sentry Error Tracking

#### Configuration

1. **Set Environment Variables:**
   ```bash
   SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/123456
   NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/123456
   ```

2. **Sentry automatically captures:**
   - Unhandled exceptions
   - API errors (500, 4xx)
   - Database connection failures
   - Performance issues (slow queries, API latency)

3. **Privacy Protection:**
   - Emails, IP addresses, and PII are automatically redacted
   - Authorization headers removed
   - Sensitive fields (passwords, tokens, credit cards) filtered

#### Sample Usage

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      operation: 'payment_processing',
      severity: 'high'
    },
    extra: {
      tenant_id: tenantId,
      amount: amount
    }
  });
  throw error;
}
```

### Health Check Endpoint

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T10:00:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 45
    },
    "stripe": {
      "status": "configured"
    },
    "supabase_auth": {
      "status": "healthy"
    }
  },
  "uptime": 86400,
  "memory": {
    "used": 52428800,
    "total": 134217728,
    "percentage": 39
  },
  "environment": "production"
}
```

**Status Codes:**
- `200`: All systems healthy
- `503`: Degraded performance
- `500`: Critical failure

### Recommended Monitoring Setup

1. **Uptime Monitoring:**
   - Service: UptimeRobot, Pingdom, or StatusCake
   - Endpoint: `https://your-domain.com/api/health`
   - Interval: Every 5 minutes
   - Alert on: 3 consecutive failures or status code != 200

2. **Error Tracking:**
   - Service: Sentry (already configured)
   - Alerts: Critical errors (500+), high error rate (>5% of requests)

3. **Performance Monitoring:**
   - Sentry Performance Monitoring (tracing enabled)
   - Track: API response times, database query latency
   - Alert on: P95 latency > 1000ms

4. **Security Monitoring:**
   - Check `/api/security/alerts` for open critical/high severity alerts
   - Alert on: Multiple failed login attempts, suspicious activities

---

## Security Best Practices

### For Developers

1. **Never commit secrets:**
   - Use `.env.local` for local development
   - Store production secrets in Vercel environment variables

2. **Input validation:**
   - Always use Zod schemas for API inputs
   - Sanitize user inputs before database queries

3. **Authentication:**
   - Always use `withAuth()` middleware for protected routes
   - Verify user roles with `requiredRole` parameter

4. **Error handling:**
   - Never expose internal errors to users
   - Log detailed errors to Sentry
   - Return generic error messages to clients

5. **Rate limiting:**
   - Implemented on `/api/auth/login` (5 attempts per minute)
   - Add to other sensitive endpoints as needed

### For Admins

1. **Enable MFA immediately:**
   - All admin accounts should have MFA enabled
   - Use authenticator app (TOTP) + backup codes

2. **Review audit logs regularly:**
   - Check for unusual patterns
   - Investigate failed login attempts
   - Monitor financial transactions

3. **Security alerts:**
   - Review `/api/security/alerts` daily
   - Investigate high/critical severity alerts immediately

4. **Password policy:**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Change every 90 days for admin accounts

5. **Access control:**
   - Grant least privilege necessary
   - Review user roles quarterly
   - Disable accounts for inactive users

---

## API Reference

### Authentication Headers

All authenticated endpoints require:

```http
Authorization: Bearer <jwt_token>
```

### Role-Based Access Control

| Endpoint | Required Role |
|----------|---------------|
| `/api/mfa/*` | Any authenticated user |
| `/api/audit/logs` | SUPER_ADMIN, AUDITOR |
| `/api/audit/auth-events` | SUPER_ADMIN, AUDITOR |
| `/api/security/alerts` (GET) | SUPER_ADMIN, AUDITOR |
| `/api/security/alerts` (PATCH) | SUPER_ADMIN |
| `/api/gdpr/request` (POST/GET) | Any authenticated user |
| `/api/gdpr/process` | SUPER_ADMIN, PROPERTY_ADMIN |

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Invalid or expired token"
}
```

#### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

#### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email format"
    }
  ]
}
```

#### 429 Too Many Requests
```json
{
  "error": "Too many requests. Please try again later."
}
```

#### 500 Internal Server Error
```json
{
  "error": "An unexpected error occurred"
}
```

---

## Incident Response

### Security Incident Procedure

1. **Detection:**
   - Automated alerts from Sentry or security monitoring
   - Manual report from user or team member

2. **Immediate Actions:**
   ```bash
   # Check security alerts
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://your-domain.com/api/security/alerts?severity=critical

   # Check recent auth events
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://your-domain.com/api/audit/auth-events?event_type=login_failed&limit=100
   ```

3. **Containment:**
   - Disable compromised user accounts
   - Reset affected passwords
   - Revoke active sessions
   - Enable IP blocking if necessary

4. **Investigation:**
   - Review audit logs for affected time period
   - Identify scope of breach
   - Document timeline of events

5. **Recovery:**
   - Patch vulnerabilities
   - Restore from backups if necessary
   - Force password reset for affected users
   - Enable MFA enforcement

6. **Post-Incident:**
   - Document lessons learned
   - Update security procedures
   - Notify affected users if required (GDPR breach notification: 72 hours)
   - File incident report

### Emergency Contacts

| Role | Responsibility | Contact Method |
|------|----------------|----------------|
| System Administrator | Infrastructure issues | On-call rotation |
| Security Lead | Security incidents | Direct message + email |
| Legal Team | Data breaches, GDPR | Email (gdpr@company.com) |
| Supabase Support | Database issues | support.supabase.com |
| Stripe Support | Payment issues | stripe.com/support |

### Data Breach Response (GDPR)

If personal data is compromised:

1. **Within 72 hours:**
   - Notify supervisory authority (if applicable)
   - Document: nature of breach, affected individuals, likely consequences

2. **Notify affected users:**
   - If high risk to their rights and freedoms
   - Provide clear description and remediation steps

3. **Mitigation:**
   - Immediate security measures
   - Offer credit monitoring if financial data exposed
   - Force password resets and MFA enrollment

---

## Migration Instructions

### Applying Security Migration

```bash
# 1. Review migration
cat supabase/migrations/0009_security_compliance.sql

# 2. Apply to database (via Supabase dashboard or CLI)
supabase db push

# 3. Verify tables were created
psql $DATABASE_URL -c "\\dt *mfa*"
psql $DATABASE_URL -c "\\dt *gdpr*"
psql $DATABASE_URL -c "\\dt auth_events"
psql $DATABASE_URL -c "\\dt security_alerts"

# 4. Test helper functions
psql $DATABASE_URL -c "SELECT has_mfa_enabled('user-uuid-here');"
psql $DATABASE_URL -c "SELECT is_mfa_required('user-uuid-here');"
```

### Installing Dependencies

```bash
npm install
```

New packages added:
- `@sentry/nextjs`: Error tracking and performance monitoring
- `otplib`: TOTP (authenticator app) support

---

## Testing Security Features

### MFA Testing

```bash
# 1. Enroll TOTP
curl -X POST https://localhost:3000/api/mfa/enroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method_type":"totp"}'

# 2. Use authenticator app to generate code

# 3. Verify code
curl -X POST https://localhost:3000/api/mfa/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method_id":"uuid-from-step-1","code":"123456"}'
```

### Audit Log Testing

```bash
# Make a change
curl -X PATCH https://localhost:3000/api/tenants/123 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"current_balance":0}'

# Check audit log
curl https://localhost:3000/api/audit/logs?table_name=tenants&limit=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### GDPR Testing

```bash
# Submit erasure request
curl -X POST https://localhost:3000/api/gdpr/request \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"request_type":"erasure"}'

# Admin processes request
curl -X POST https://localhost:3000/api/gdpr/process \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"request_id":"uuid","action":"complete"}'
```

---

## Compliance Certifications

- ✅ **GDPR Ready:** Data subject rights, retention policies, breach notification
- ✅ **SOX Compliant:** 7-year financial record retention, immutable audit logs
- ✅ **PCI-DSS:** Payment processing via Stripe (PCI-compliant payment gateway)
- ⏳ **SOC 2:** In progress (requires formal audit)
- ⏳ **HIPAA:** Not applicable (no PHI data)

---

## Support & Questions

For security concerns or questions:
- **Security Email:** security@your-company.com
- **Bug Reports:** https://github.com/your-org/summit-os/issues (for non-sensitive issues)
- **Documentation:** https://docs.your-company.com

**Responsible Disclosure:** If you discover a security vulnerability, please email security@your-company.com with details. Do not create public GitHub issues for security vulnerabilities.
