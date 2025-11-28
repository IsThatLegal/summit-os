import os
import asyncio
import traceback
import json
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# --- CONFIGURATION ---
CACHE_FILE = "gate_cache.json"
CACHE_SYNC_INTERVAL = 60  # seconds
POLL_INTERVAL = 2         # seconds

# --- SETUP ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    raise ValueError("Supabase URL and Anon Key must be set in the .env file.")

supabase: Client = create_client(url, key)

# --- TASKS ---

async def sync_cache():
    """
    Background task to periodically sync active gate codes from Supabase to a local JSON file.
    """
    while True:
        try:
            print("🔄 Syncing cache with cloud...")
            response = supabase.from_("tenants") \
                .select("gate_access_code, first_name") \
                .eq("is_locked_out", False) \
                .execute()

            if response.data:
                active_codes = response.data
                with open(CACHE_FILE, "w") as f:
                    json.dump(active_codes, f, indent=2)
                print(f"💾 CACHE SYNCED: {len(active_codes)} active codes saved.")
            else:
                print("🤔 No active tenants found to cache.")

        except Exception as e:
            print("⚠️  CLOUD OFFLINE - Could not sync cache. Keeping existing cache.")
            print(f"   Error: {e}")
        
        await asyncio.sleep(CACHE_SYNC_INTERVAL)


async def poll_gate_logs():
    """
    Foreground task to poll the gate_logs table for real-time commands from the web app.
    """
    print("📡 Polling for real-time commands from cloud...")
    processed_log_ids = set()

    while True:
        try:
            three_seconds_ago = datetime.now(timezone.utc) - timedelta(seconds=(POLL_INTERVAL + 1))
            
            response = supabase.from_("gate_logs") \
                .select("id, action, tenants(first_name)") \
                .in_("action", ["entry_granted", "entry_denied"]) \
                .gt("timestamp", three_seconds_ago.isoformat()) \
                .execute()

            if response.data:
                for log in response.data:
                    if log['id'] not in processed_log_ids:
                        tenant_name = log.get('tenants', {}).get('first_name') or 'Unknown'
                        
                        if log['action'] == 'entry_granted':
                            print(f"🟢 REMOTE OPEN: Gate opening for {tenant_name} (Log ID: {log['id']})")
                        
                        processed_log_ids.add(log['id'])

        except Exception:
            print("⚠️  CONNECTION LOST - Switching to Offline Mode (Listening to local Keypad)...")
            traceback.print_exc()
            pass

        await asyncio.sleep(POLL_INTERVAL)


async def main():
    print("🤖 Gatekeeper Service Initializing...")
    await asyncio.gather(
        sync_cache(),
        poll_gate_logs()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n💤 Shutting down Gatekeeper service.")