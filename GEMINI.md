# GEMINI.md - Project Overview & Context

This file provides a comprehensive overview of the "SummitOS" project for future AI agent interactions.

## 1. Project Vision: The Automated Self-Storage Facility

**SummitOS** is an AI-powered, automated self-storage management system designed to replace legacy software like Sitelink. The vision is to create a "swarm of agents" that manage sales, collections, and maintenance autonomously, supported by a modern hardware and software stack.

**Operational Modes:** SummitOS is designed for flexibility, supporting various operational modes:
- **Online Webapp Dashboard:** The primary user interface for facility management.
- **CLI (Command Line Interface):** For advanced management, development, and system interactions.
- **Offline Modes:** Critical hardware layers (like the Gatekeeper) will function autonomously with cached data even during internet outages, ensuring continuous operation and safety.

## 2. Core Technologies & Architecture

- **Frontend:** Next.js (React)
- **Database:** Supabase (PostgreSQL)
- **AI Logic:** LangChain & LangGraph
- **Payments:** Stripe
- **Hardware Simulation (Python):** `requests`, `python-dotenv`
- **Language:** TypeScript, Python
- **Styling:** Tailwind CSS
- **Testing:** Jest

## 3. Current Status & How to Run

We have successfully completed the MVP for core application logic, financial foundations, and hardware simulation.

### 3.1. Web Application (The "Brain")

- **Dependencies:** `npm install`
- **Run Server:** `npm run dev`
- **Access:** `http://localhost:3000`
- **Features:**
    - Full CRUD (Create, Read, Update, Delete) for Tenants and Units.
    - Financial dashboard for logging (simulated) Stripe payments.
    - Automated business logic (auto-lockout for new tenants with balance, auto-unlock on payment).
    - **Human-in-the-Loop AI:** A "Collect" button on late tenants runs the "Enforcer" agent and displays its drafted message in a review modal before action is taken.

### 3.2. Hardware Simulators (The "Body")

The hardware layer is simulated with Python scripts running in a virtual environment.

- **Setup:**
    1. `python3 -m venv .venv`
    2. `source .venv/bin/activate` (or `.venv\Scripts\activate` on Windows)
    3. `.venv/bin/pip install -r scripts/requirements.txt`
- **Gatekeeper (`gate_controller.py`):** Simulates the on-site gate controller listening for database commands.
    - **Run:** `python scripts/gate_controller.py`
- **Watcher (`camera_simulator.py`):** Simulates an LPR camera sending plate data to the API.
    - **Run:** `python scripts/camera_simulator.py`

### 3.3. Testing

- **Integration Tests:** The Jest test suite validates critical API endpoints.
    - **Prerequisite:** The Next.js server must be running (`npm run dev`).
    - **Run:** `npm test`
- **Agent Tests:** A standalone script tests the AI agent's logic directly.
    - **Run:** `npm run test:agent`

## 4. Key Files

- **`app/page.tsx`**: The main admin dashboard UI.
- **`app/api/**`**: API routes for gate access, data CRUD, financials, and AI.
- **`lib/agents/enforcer/graph.ts`**: The core logic for the "Enforcer" AI agent, built with LangGraph.
- **`components/enforcer-modal.tsx`**: The React component for the "Human-in-the-Loop" review UI.
- **`scripts/gate_controller.py`**: Simulates the physical gate hardware.
- **`scripts/camera_simulator.py`**: Simulates the LPR camera hardware.
- **`scripts/test-enforcer.ts`**: Standalone test script for the AI agent.
- **`supabase/migrations/**`**: Database schema and migration files.
- **`tests/integration/**`**: Jest integration tests for the API.
- **`.env.local` & `.env`**: Environment variable files (Supabase, Stripe, OpenAI keys).
