# SummitOS

A comprehensive property management system for automated gate access control, tenant management, and payment processing.

## 🚨 **SECURITY WARNING**

**⚠️ NOT PRODUCTION READY** - SummitOS currently has critical security vulnerabilities:

- 🔴 **Hardcoded API keys** and secrets
- 🔴 **No database authentication** - completely open
- 🔴 **Missing API authentication** - all endpoints unprotected
- 🔴 **No input validation** - vulnerable to attacks

**See [SECURITY_PLAN.md](./SECURITY_PLAN.md) for comprehensive security roadmap.**

## 🚀 Features

- **Tenant Management**: Complete CRUD operations for tenant data
- **Gate Access Control**: Automated access decisions based on tenant status
- **Payment Processing**: Stripe integration for automated payments
- **AI Agents**: LangGraph-powered collections and management agents
- **Hardware Integration**: IoT gate control and license plate recognition
- **Real-time Dashboard**: Live status monitoring and management

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Payments**: Stripe API
- **AI**: LangGraph agents
- **Testing**: Playwright (E2E), Jest (Integration)
- **Hardware**: Python scripts for IoT integration

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account (for payments)

## 🚀 Quick Start

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd summit-os
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase and Stripe credentials
```

3. **Run the development server**:
```bash
npm run dev
```

4. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## 🧪 Testing

### E2E Tests
```bash
npx playwright test
```

### Integration Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## 📁 Project Structure

```
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── dashboard/         # Main dashboard
│   └── gate-simulator/    # Gate testing interface
├── components/            # React components
├── lib/                   # Shared utilities
├── scripts/               # Hardware integration scripts
├── supabase/             # Database migrations and seeds
├── e2e/                  # Playwright tests
└── tests/                # Jest integration tests
```

## 🔧 Configuration

### Environment Variables
Required variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service key
- `STRIPE_SECRET_KEY`: Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key

### Database Setup
1. Create Supabase project
2. Run migrations in `supabase/migrations/`
3. Seed data with `supabase/seed.sql`

## 🚪 Gate Access Flow

1. **Tenant Creation**: Add tenants with balance and gate codes
2. **Auto-Lockout**: Tenants with positive balances are automatically locked out
3. **Gate Access**: Gate API checks tenant status before granting access
4. **Payment Processing**: Stripe payments update tenant balances
5. **Auto-Unlock**: Successful payments unlock tenant access

## 🤖 AI Agents

### The Enforcer (Collections)
- Monitors tenant balances
- Drafts collection communications
- Human-in-the-loop approval system

### Future Agents
- **The Closer**: Sales and lead conversion
- **The Steward**: Maintenance coordination

## 🔌 Hardware Integration

### Gate Controller
- Python script for IoT relay control
- Offline failover capability
- Real-time polling for access commands

### License Plate Recognition
- Computer vision integration
- Automatic tenant identification
- API integration with gate system

## 📊 Current Status

### ✅ Completed
- Core tenant management
- Gate access control logic
- Payment processing with Stripe
- E2E test coverage
- AI agent framework
- Hardware integration scripts

### 🚧 In Progress
- Automated billing system
- Tenant portal
- Production deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test && npx playwright test`
5. Submit a pull request

## 📄 License

[Add your license here]

## 🆘 Support

For issues and questions:
- Check existing [GitHub Issues](https://github.com/your-repo/issues)
- Create new issue with detailed description
- Review [ROADMAP.md](./ROADMAP.md) for development status
