# Security & Compliance Quick Start Guide

**⚡ Get your production security up and running in under 30 minutes**

---

## Step 1: Apply Database Migration (5 minutes)

### Via Supabase Dashboard (Easiest)

1. Go to https://app.supabase.com
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Open `supabase/migrations/0009_security_compliance.sql` in your editor
6. Copy the entire contents
7. Paste into Supabase SQL Editor
8. Click "Run" (bottom right)
9. Wait for success message

### Via Command Line (Alternative)

```bash
# If you have Supabase CLI configured
supabase db push
```

### Verify Migration Worked

Go to SQL Editor and run:
```sql
-- Should return 1 row for each MFA method type
SELECT * FROM mfa_enforcement_policy;

-- Should show MFA required for admins
SELECT role, mfa_required, grace_period_days
FROM mfa_enforcement_policy
WHERE mfa_required = true;
```

Expected output:
```
role           | mfa_required | grace_period_days
SUPER_ADMIN    | true         | 7
PROPERTY_ADMIN | true         | 14
FINANCE_ADMIN  | true         | 14
AUDITOR        | true         | 30
```

✅ **Success!** Security tables are now ready.

---

## Step 2: Set Up Sentry (10 minutes)

### Create Sentry Account

1. Go to https://sentry.io/signup/
2. Create account (free tier is fine for starting)
3. Create new project:
   - Platform: "Next.js"
   - Project name: "Summit OS"
4. Copy your DSN (looks like: `https://xxxxx@o123456.ingest.sentry.io/123456`)

### Add to Vercel

1. Go to https://vercel.com
2. Select your Summit OS project
3. Go to Settings → Environment Variables
4. Add these two variables:
   ```
   SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/123456
   NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/123456
   ```
   (Use the same DSN for both)
5. Click "Save"
6. Redeploy: Deployments → Latest → ... → Redeploy

### Test Sentry (Optional)

Create a test error:
```bash
curl https://your-domain.com/api/test-error
```

Then check Sentry dashboard - you should see the error appear within seconds.

✅ **Success!** Error tracking is now active.

---

## Step 3: Enable MFA for Your Account (10 minutes)

### Login and Get Token

```bash
# Login via API
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

Save the `token` from response.

### Enroll TOTP (Authenticator App)

```bash
export TOKEN="your-token-here"

curl -X POST https://your-domain.com/api/mfa/enroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method_type":"totp"}'
```

Response will include:
- `secret`: Enter this manually in your authenticator app
- `qr_code_url`: Or scan this with your phone

**Recommended Authenticator Apps:**
- Google Authenticator (iOS/Android)
- Authy (iOS/Android)
- Microsoft Authenticator (iOS/Android)

### Verify Your Setup

1. Open authenticator app
2. Find "Summit OS" entry
3. Copy the 6-digit code
4. Verify it:

```bash
curl -X POST https://your-domain.com/api/mfa/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method_id":"<method_id_from_enroll>","code":"123456"}'
```

### Generate Backup Codes

```bash
curl -X POST https://your-domain.com/api/mfa/enroll \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method_type":"backup_codes"}'
```

**IMPORTANT:** Save these 8 backup codes in a secure location (password manager, encrypted file). Each can only be used once.

Example backup codes:
```
A1B2-C3D4-E5F6
G7H8-I9J0-K1L2
M3N4-O5P6-Q7R8
... (8 total)
```

✅ **Success!** Your account is now protected with MFA.

---

## Step 4: Set Up Uptime Monitoring (5 minutes)

### Option A: UptimeRobot (Free, Recommended)

1. Go to https://uptimerobot.com/signUp
2. Create free account
3. Add new monitor:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: **Summit OS Health Check**
   - URL: `https://your-domain.com/api/health`
   - Monitoring Interval: **5 minutes**
4. Set up alerts:
   - Alert Contacts → Add your email
   - Alert When: **Down** (3 times)
5. Save

### Option B: Pingdom (Alternative)

1. Go to https://www.pingdom.com
2. Create account
3. Create check for `https://your-domain.com/api/health`
4. Set check interval to 5 minutes

### Test Health Check

Visit in browser: `https://your-domain.com/api/health`

Should see:
```json
{
  "status": "healthy",
  "checks": {
    "database": {"status": "healthy", "latency": 45},
    "stripe": {"status": "configured"},
    "supabase_auth": {"status": "healthy"}
  }
}
```

✅ **Success!** You'll now get alerts if the system goes down.

---

## Step 5: Test Security Features (Optional but Recommended)

### Test Audit Logging

```bash
# Make a change (as admin)
curl -X POST https://your-domain.com/api/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"first_name":"Test","email":"test@test.com",...}'

# Check audit log
curl https://your-domain.com/api/audit/logs?table_name=tenants&limit=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Should see the tenant creation logged with old_data and new_data.

### Test GDPR Request

```bash
# Submit erasure request
curl -X POST https://your-domain.com/api/gdpr/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"request_type":"access"}'

# Check status
curl https://your-domain.com/api/gdpr/request \
  -H "Authorization: Bearer $TOKEN"
```

Should see request with status "pending".

✅ **Success!** Security features are working.

---

## What You Get Out of the Box

### For Admins
- 🔐 **MFA Protection:** TOTP + backup codes prevent account takeover
- 📊 **Audit Trail:** Every database change is logged with who/what/when
- 🚨 **Security Alerts:** Get notified of suspicious activity
- 📋 **GDPR Tools:** Handle data subject requests with built-in workflows

### For Tenants
- 🔒 **Account Security:** Optional MFA available
- 📝 **Data Rights:** Submit GDPR requests (access, erasure, etc.)
- 🛡️ **Privacy:** PII automatically protected and anonymized

### For DevOps
- 📡 **Error Tracking:** Sentry catches all production errors
- ❤️ **Health Monitoring:** `/api/health` endpoint for uptime checks
- 📈 **Performance Metrics:** Automatic API latency tracking
- 🔍 **Debugging:** Full error context without PII leaks

---

## Troubleshooting

### Migration Failed

**Error:** "relation already exists"
- **Solution:** Some tables already exist. This is OK if you're re-running. Skip to verification step.

**Error:** "function does not exist"
- **Solution:** Run the entire migration file, not just parts. Functions are defined at the end.

### Sentry Not Receiving Errors

1. Check environment variables are set:
   ```bash
   vercel env ls
   ```
2. Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are both set
3. Redeploy after adding env vars
4. Trigger a test error:
   ```bash
   # In your code, add temporarily:
   throw new Error("Test Sentry integration");
   ```

### MFA Code Not Working

1. **Time sync issue:** Ensure your phone's time is accurate (auto-sync)
2. **Wrong method ID:** Copy method_id from `/api/mfa/enroll` response
3. **Code already used:** TOTP codes change every 30 seconds, wait for new one
4. **Rate limited:** Wait 15 minutes if you had 5 failed attempts

### Health Check Returns 503

This means one service is degraded:
1. Check `checks.database.status` - if "unhealthy", database is down
2. Check `checks.supabase_auth.status` - if "degraded", auth issue
3. Check Vercel logs for more details

---

## Next Steps After Quick Start

1. **Enable MFA for all admin accounts** (within their grace period)
2. **Review security alerts daily** (`/api/security/alerts`)
3. **Test GDPR workflows** with dummy data
4. **Set up data cleanup cron job** (see full docs)
5. **Review audit logs weekly** for unusual patterns

---

## Full Documentation

For complete details, see:
- **`SECURITY_COMPLIANCE.md`** - Complete reference (API docs, procedures)
- **`SECURITY_IMPLEMENTATION_SUMMARY.md`** - What was built and why
- **`DEPLOYMENT_READINESS.md`** - Overall production readiness

---

## Need Help?

**Common Questions:**
- "How do I reset MFA if I lose my phone?" → Use backup codes or contact admin
- "Can I use SMS instead of authenticator app?" → Yes, but requires Twilio setup
- "How long are audit logs kept?" → 7 years (financial compliance)
- "What happens when I request data erasure?" → Personal info anonymized, financial records kept

**Issues?**
- Check `SECURITY_COMPLIANCE.md` → "Troubleshooting" section
- Create GitHub issue (for non-security bugs)
- Email security@your-company.com (for security concerns)

---

🎉 **Congratulations!** Your storage facility management system is now **production-ready** with enterprise-grade security and compliance.
