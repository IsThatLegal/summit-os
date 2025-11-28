# Environment Setup Guide

This document provides detailed instructions for setting up the development environment for SummitOS.

## 📋 Prerequisites

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (comes with Node.js)
- **Git**: For version control
- **VS Code**: Recommended IDE with extensions

## 🔧 Required Accounts & Services

### 1. Supabase Account
- Visit [https://supabase.com](https://supabase.com)
- Create a new project
- Note your project URL and API keys

### 2. Stripe Account (for payments)
- Visit [https://stripe.com](https://stripe.com)
- Create a free account
- Get test API keys from the dashboard

## 🚀 Setup Instructions

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd summit-os
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

#### Getting Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL, anon key, and service_role key

#### Getting Stripe Credentials
1. Go to your Stripe dashboard
2. Navigate to Developers → API keys
3. Create new test keys or use existing ones

### 4. Database Setup

#### Option A: Automatic Setup (Recommended)
```bash
# Apply database migrations
npx supabase db push

# Seed initial data
npx supabase db seed
```

#### Option B: Manual Setup
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migration files from `supabase/migrations/` in order
4. Run the seed script from `supabase/seed.sql`

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 🧪 Testing Setup

### Install Playwright Browsers
```bash
npx playwright install
```

### Run Tests
```bash
# E2E Tests
npx playwright test

# Integration Tests
npm test

# Linting
npm run lint
```

## 🔍 Verification Steps

### 1. Check Environment Variables
```bash
# Verify environment variables are loaded
npm run dev
# Check the console for any environment variable errors
```

### 2. Test Database Connection
- Navigate to [http://localhost:3000](http://localhost:3000)
- Try adding a new tenant
- Verify it appears in the database

### 3. Test Payment Processing
- Create a tenant with a balance
- Use the "Process Payment" button
- Verify the payment goes through successfully

### 4. Test Gate Access
- Navigate to [http://localhost:3000/gate-simulator](http://localhost:3000/gate-simulator)
- Test with different tenant gate codes
- Verify access is granted/denied correctly

## 🛠️ Development Workflow

### 1. Making Changes
```bash
# Create a new branch
git checkout -b feature/your-feature-name

# Make your changes
# ...

# Run tests
npm test && npx playwright test

# Commit changes
git add .
git commit -m "feat: add your feature description"
```

### 2. Database Changes
```bash
# Create new migration
npx supabase migration new your_migration_name

# Apply changes
npx supabase db push
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Environment Variables Not Loading
- Ensure `.env.local` is in the root directory
- Check that variable names match exactly
- Restart the development server after making changes

#### 2. Database Connection Issues
- Verify Supabase URL and keys are correct
- Check if your IP is allowed in Supabase settings
- Ensure database migrations have been applied

#### 3. Stripe Payment Errors
- Verify Stripe keys are correct and active
- Check if you're using test keys for development
- Ensure Stripe API version is compatible

#### 4. Test Failures
- Install Playwright browsers: `npx playwright install`
- Check if the development server is running
- Verify environment variables are set correctly

### Getting Help

1. Check the console logs for detailed error messages
2. Review the [ROADMAP.md](./ROADMAP.md) for current status
3. Check existing GitHub Issues
4. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Playwright Documentation](https://playwright.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🔄 Next Steps

After setting up the environment:

1. **Explore the Dashboard**: Navigate through the tenant management interface
2. **Test Gate Simulator**: Try the gate access simulation
3. **Run E2E Tests**: Verify all functionality works as expected
4. **Review Documentation**: Read through ROADMAP.md and other documentation files
5. **Join Development**: Check out the contributing guidelines and start contributing!