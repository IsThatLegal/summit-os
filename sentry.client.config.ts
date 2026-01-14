import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: ENVIRONMENT,

  // Performance monitoring
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

  // Integrations
  // Note: Using default integrations provided by Sentry
  // replayIntegration and browserTracingIntegration may require additional setup

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Filter out sensitive data
  beforeSend(event) {
    // Remove sensitive user data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    // Remove authorization headers
    if (event.request?.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.authorization;
    }

    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    // Network errors
    'Network request failed',
    'Failed to fetch',
  ],
});
