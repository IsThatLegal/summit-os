import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Edge runtime specific configuration
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.authorization;
    }

    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }

    return event;
  },
});
