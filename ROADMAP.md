# SummitOS Development Roadmap (v2)

This document outlines the path from a Minimum Viable Product (MVP) to a full, production-ready "SummitOS" application, incorporating critical feedback on safety, legal, and architectural soundness.

### Phase 1: Minimum Viable Product (MVP)

**Goal:** Prove the core software loop: a web application that can grant or deny gate access based on a tenant's status, with a simple way to manage the data and simulate gate access.

**1. Foundational Setup (✅ *Completed*)**
   - **[Done]** Initialize Next.js project with TypeScript and Tailwind CSS.
   - **[Done]** Define and create the core database schema (`units`, `tenants`, `gate_logs`) in Supabase.
   - **[Done]** Build a basic dashboard UI to display facility status.
   - **[Done]** Implement the core gate access logic at the `/api/gate/access` endpoint.
   - **[Done]** Implement basic CRUD forms for Tenants and Units on the dashboard.

**2. Gate Access Simulation (✅ *Completed*)**
   - **[Done]** Build a "Gate Simulator" page (`/gate-simulator`) to test the gate access API without physical hardware.

---

### Phase 1.5: The Financial Foundation

**Goal:** Connect the gate logic to real financial data, laying the groundwork for automated collections.

**1. Payment Integration Setup**
   - **Task:** Integrate the Stripe API to handle payment processing. Focus initially on setting up webhooks and the ability to *manually* record a payment against a tenant's balance.
   - **Why:** You cannot test "The Enforcer" if you don't have real payment data. This step is the prerequisite for any collections logic.

**2. The Ledger**
   - **Task:** Create a `transactions` table in Supabase to log all financial events (e.g., monthly charge, payment received, fee waived). This provides a clear, auditable history for each tenant.
   - **Why:** A simple `current_balance` is not enough for a real business. You need a ledger to track *why* the balance is what it is.

---

### Phase 2: Production-Ready Application

**Goal:** Build out the full, robust, and autonomous system, incorporating AI agents, real hardware integration, and payment processing.

**1. Full Payment Automation**
   - **Task:** Build an automated monthly billing system using a scheduled function (cron job) to create a new charge transaction for each tenant.
   - **Task:** Create a secure Tenant Portal where customers can self-serve: view their balance and transaction history, update their payment methods, and pay their bills via Stripe.

**2. AI Agent Implementation (The "Brain")**
   - **Task:** Integrate LangGraph to build stateful AI agents.
   - **Task:** Build **"The Enforcer"** (Collections Agent) with **Legal Guardrails**.
     - It will monitor tenant balances and trigger multi-step communication workflows.
     - **CRITICAL:** For the first month of operation, all automated communications (texts/emails) must be queued for a **"Human-in-the-Loop" review**. An admin must click "Send" on each message until the agent's behavior is trusted.
   - **Task:** Build **"The Closer"** (Sales Agent) and **"The Steward"** (Maintenance Agent).

**3. Hardware & IoT Integration (The "Body")**
   - **Task:** Set up and configure the on-site local server (e.g., Raspberry Pi) and IoT relays.
   - **Task:** Implement **"The Watcher"** (Computer Vision) for license plate recognition.
   - **Task:** Implement a **Local Failover Protocol (Critical Safety)**.
     - The cloud application will periodically *push* a list of all valid gate codes to the local on-site server.
     - If the internet connection fails, the local server will operate using this cached list, ensuring tenants are never locked out due to a network outage.

**4. Production Hardening & Scalability**
   - **Task:** Implement robust Supabase authentication with distinct roles for admins and tenants.
   - **Task:** Write comprehensive unit, integration, and end-to-end tests.
   - **Task:** Establish a CI/CD pipeline for automated testing and deployments (e.g., to Vercel).
   - **Task:** Enhance security across the board (rate limiting, audit logs, monitoring).