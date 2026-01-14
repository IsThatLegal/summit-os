import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: ENVIRONMENT,

  // Performance monitoring
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Enhanced error context
  integrations: [
    Sentry.httpIntegration({
      tracing: {
        // Trace all outgoing requests
        tracePropagationTargets: [
          /^https:\/\/[^/]*\.supabase\.co/,
          /^https:\/\/api\.stripe\.com/,
        ],
      },
    }),
  ],

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from event
    if (event.request) {
      // Remove authorization headers
      if (event.request.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers.Cookie;
      }

      // Remove sensitive query parameters
      if (event.request.query_string) {
        const sensitiveParams = ['token', 'api_key', 'password', 'secret'];
        let queryString = event.request.query_string;
        sensitiveParams.forEach(param => {
          const regex = new RegExp(`${param}=[^&]*`, 'gi');
          queryString = queryString.replace(regex, `${param}=[REDACTED]`);
        });
        event.request.query_string = queryString;
      }

      // Remove sensitive body data
      if (event.request.data && typeof event.request.data === 'object') {
        const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'cvv', 'ssn'];
        const redactedData = { ...event.request.data };

        sensitiveFields.forEach(field => {
          if (field in redactedData) {
            redactedData[field] = '[REDACTED]';
          }
        });

        event.request.data = redactedData;
      }
    }

    // Remove user email/PII
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    // Add custom tags
    event.tags = {
      ...event.tags,
      app_version: process.env.npm_package_version || 'unknown',
    };

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Expected errors that we handle gracefully
    'Invalid or expired token',
    'Missing or invalid authorization header',
    'Insufficient permissions',
    // Database connection issues (handled by Supabase)
    'Connection terminated unexpectedly',
    // Rate limiting (expected behavior)
    'Too many requests',
  ],
});
