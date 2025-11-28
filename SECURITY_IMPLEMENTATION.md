# Security Implementation Roadmap

## 🚨 **IMMEDIATE CRITICAL FIXES (This Week)**

### 1. Remove Hardcoded Secrets
```typescript
// FIX: app/api/finance/charge/route.ts
// BEFORE (VULNERABLE):
stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', {

// AFTER (SECURE):
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}
stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
```

### 2. Implement Database Row Level Security
```sql
-- FIX: supabase/migrations/0005_secure_rls.sql
-- BEFORE (VULNERABLE):
CREATE POLICY "Allow all" ON tenants FOR ALL USING (true);

-- AFTER (SECURE):
CREATE POLICY "Tenants can view own data" ON tenants 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON tenants 
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin' OR 
    auth.jwt() ->> 'role' = 'property_manager'
  );
```

### 3. Add Authentication Middleware
```typescript
// CREATE: lib/auth.ts
export async function requireAuth(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const { data: user, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid authentication token');
  }
  
  return user;
}

// APPLY TO ALL API ROUTES:
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    // ... rest of API logic
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### 4. Input Validation with Zod
```typescript
// CREATE: lib/validations.ts
import { z } from 'zod';

export const createTenantSchema = z.object({
  first_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/),
  gate_access_code: z.string().min(3).max(20),
  current_balance: z.number().min(0).max(10000),
});

// APPLY TO API ROUTES:
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = createTenantSchema.parse(body);
    // ... use validatedData
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 });
    }
  }
}
```

---

## 🟡 **PHASE 2: ENHANCED SECURITY (Next 2-3 Weeks)**

### 5. Multi-Factor Authentication
```typescript
// CREATE: lib/mfa.ts
import speakeasy from 'speakeasy';

export function generateTOTPSecret(userEmail: string) {
  return speakeasy.generateSecret({
    name: `SummitOS (${userEmail})`,
    issuer: 'SummitOS',
    length: 32
  });
}

export function verifyTOTP(token: string, secret: string) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2
  });
}
```

### 6. Rate Limiting Middleware
```typescript
// CREATE: lib/rateLimit.ts
const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(
  request: Request, 
  limit: number = 100, 
  windowMs: number = 60000
) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / windowMs)}`;
  
  const current = rateLimit.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (current.count >= limit) {
    throw new Error('Rate limit exceeded');
  }
  
  current.count++;
  rateLimit.set(key, current);
  
  // Cleanup old entries
  setTimeout(() => rateLimit.delete(key), windowMs);
}
```

### 7. Security Headers Configuration
```typescript
// UPDATE: next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { 
            key: 'Content-Security-Policy', 
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" 
          },
          { 
            key: 'Strict-Transport-Security', 
            value: 'max-age=31536000; includeSubDomains; preload' 
          },
        ],
      },
    ];
  },
};
```

---

## 🟢 **PHASE 3: ADVANCED SECURITY (Next 4-6 Weeks)**

### 8. Audit Logging System
```typescript
// CREATE: lib/audit.ts
export async function logAuditEvent(event: {
  userId: string;
  action: string;
  resource: string;
  details?: any;
  ipAddress: string;
  userAgent: string;
}) {
  const { error } = await supabase.from('audit_logs').insert({
    ...event,
    timestamp: new Date().toISOString(),
    severity: 'INFO'
  });
  
  if (error) {
    console.error('Failed to log audit event:', error);
  }
}

// USAGE IN API ROUTES:
await logAuditEvent({
  userId: user.id,
  action: 'CREATE_TENANT',
  resource: 'tenants',
  details: { tenantId: newTenant.id },
  ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  userAgent: request.headers.get('user-agent') || 'unknown'
});
```

### 9. Session Management
```typescript
// CREATE: lib/session.ts
export async function createSecureSession(user: any) {
  const sessionToken = crypto.randomUUID();
  const refreshToken = crypto.randomUUID();
  
  await supabase.from('user_sessions').insert({
    user_id: user.id,
    session_token: sessionToken,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    created_at: new Date(),
    ip_address: '', // Get from request
    user_agent: '', // Get from request
  });
  
  return { sessionToken, refreshToken };
}

export async function validateSession(sessionToken: string) {
  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .eq('is_active', true)
    .single();
    
  if (error || !session || new Date(session.expires_at) < new Date()) {
    throw new Error('Invalid or expired session');
  }
  
  return session;
}
```

### 10. Encryption for Sensitive Data
```typescript
// CREATE: lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('summit-os', 'utf8'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  decipher.setAAD(Buffer.from('summit-os', 'utf8'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### Week 1: Critical Fixes
- [ ] Remove all hardcoded secrets and API keys
- [ ] Implement proper Row Level Security policies
- [ ] Add authentication middleware to all API routes
- [ ] Add input validation with Zod schemas
- [ ] Set up basic error handling and logging

### Week 2: Enhanced Security
- [ ] Implement MFA for admin users
- [ ] Add rate limiting to all API endpoints
- [ ] Configure security headers
- [ ] Set up audit logging system
- [ ] Add session management

### Week 3: Advanced Security
- [ ] Implement encryption for sensitive data
- [ ] Add role-based access control
- [ ] Set up monitoring and alerting
- [ ] Add CSRF protection
- [ ] Implement secure password policies

### Week 4: Testing & Validation
- [ ] Security testing with OWASP ZAP
- [ ] Penetration testing
- [ ] Code security review
- [ ] Documentation updates
- [ ] Security training for team

---

## 🛠️ **TOOLS & SERVICES NEEDED**

### Security Tools
- **SAST**: Snyk (for dependency scanning)
- **DAST**: OWASP ZAP (for dynamic testing)
- **WAF**: Cloudflare WAF or AWS WAF
- **Monitoring**: Datadog or New Relic
- **Secrets**: AWS Secrets Manager or HashiCorp Vault

### Additional Dependencies
```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "speakeasy": "^2.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "express-rate-limit": "^6.7.0"
  }
}
```

---

## 🎯 **SUCCESS METRICS**

### Security KPIs
- **Zero critical vulnerabilities** in production
- **All API endpoints** protected with authentication
- **100% of sensitive data** encrypted at rest
- **MFA enabled** for all admin users
- **Audit logging** for all sensitive operations
- **Rate limiting** active on all public endpoints

### Compliance Goals
- **PCI DSS Level 1** compliance for payment processing
- **GDPR compliance** for data protection
- **SOC 2 Type II** readiness for enterprise customers
- **OWASP Top 10** protection implemented

---

**This roadmap provides a step-by-step approach to transform SummitOS from its current state to a military-grade secure platform capable of handling real customer data and financial transactions.**