# GEMINI.md - Project Overview & Context

This file provides a comprehensive overview of the "SummitOS" project for future AI agent interactions.

## 1. Project Vision: The Automated Self-Storage Facility

**SummitOS** is an AI-powered, automated self-storage management system designed to replace legacy software like Sitelink. The vision is to create a "swarm of agents" that manage sales, collections, and maintenance autonomously, supported by a modern hardware and software stack.

### Phase 1: The Hardware Layer (The Body)
- **The "Gatekeeper" (IoT):** Replaces proprietary gate controllers with low-cost, industrial IoT relays (Shelly Pro, ESP32) controlled by a local server (Raspberry Pi/NUC). The system uses the MQTT protocol for near-instant, reliable gate control (<200ms latency), even if the internet connection is down. It denies access for past-due tenants and initiates a payment workflow via text.
- **The "Watcher" (Computer Vision):** Transforms passive security cameras into active gatekeepers. A lightweight model (e.g., YOLOv8) performs real-time license plate recognition, allowing registered tenants seamless, automatic gate access, providing a premium user experience.

### Phase 2: The Software Layer (The Brain)
A series of autonomous AI agents will manage facility operations:
- **Agent 1: "The Closer" (Sales & Onboarding):** A voice/text bot that handles inquiries 24/7. It can offer virtual tours by granting temporary gate access and allows customers to complete the entire leasing and payment process on their phone without human intervention.
- **Agent 2: "The Enforcer" (Collections):** An automated, multi-stage collections agent. It sends polite reminders, issues warnings, and can even negotiate payment plans or offer small, budgeted fee waivers to secure payment.
- **Agent 3: "The Steward" (Maintenance):** An AI-powered maintenance ticketing system. It allows tenants to report issues via text/photo, uses vision models to analyze the problem, and automatically dispatches a work order to maintenance personnel with relevant details.

## 2. Core Technologies & Architecture

- **Frontend:** Next.js (React) - For a fast, SEO-friendly, and mobile-first user interface.
- **Database:** Supabase - Chosen for its real-time capabilities, which are essential for instant gate access and live dashboard updates.
- **AI Logic:** LangGraph - To build stateful, multi-step AI agents that can loop, wait, and make decisions over time.
- **Gate IoT:** Home Assistant + ESPHome - A rock-solid, open-source platform for orchestrating the IoT relays and exposing a local API for our system to interact with.
- **Payments:** Stripe - For robust, API-driven recurring billing and payment processing.
- **Language:** TypeScript
- **Styling:** Tailwind CSS

## 3. Current Status & How to Run

The project has been initialized with a foundational Next.js frontend and a Supabase database schema.

### Environment Setup
Create a `.env.local` file in the project root with Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### Install Dependencies
```bash
npm install
```

### Database Setup
The initial database schema is located at `supabase/migrations/0001_initial_schema.sql`. This should be run in the Supabase SQL Editor for a new project. Sample data is available in `supabase/seed.sql`.

### Run the Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

## 4. Key Files

- **`package.json`**: Defines project scripts and dependencies.
- **`app/page.tsx`**: The main admin dashboard UI, currently fetching and displaying unit and gate log data.
- **`lib/supabaseClient.ts`**: Initializes the Supabase client.
- **`supabase/migrations/0001_initial_schema.sql`**: The database schema definition.
- **`supabase/config.toml`**: Configuration for the Supabase CLI.
- **`supabase/seed.sql`**: Sample data for populating the database.