import os
import asyncio
import traceback
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# --- SETUP ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    raise ValueError("Supabase URL and Anon Key must be set in the .env file.")

supabase: Client = create_client(url, key)

# --- POLLING LOGIC ---

async def poll_gate_logs():
    """
    Continuously polls the gate_logs table for recent 'entry_granted' actions.
    This simulates a hardware controller listening for commands.
    """
    print("🤖 Gatekeeper service started. Listening for gate commands...")
    processed_log_ids = set()

    while True:
        try:
            three_seconds_ago = datetime.now(timezone.utc) - timedelta(seconds=3)
            
            response = supabase.from_("gate_logs") \
                .select("id, action, tenant_id, tenants(first_name)") \
                .in_("action", ["entry_granted", "entry_denied"]) \
                .gt("timestamp", three_seconds_ago.isoformat()) \
                .execute()

            if response.data:
                for log in response.data:
                    if log['id'] not in processed_log_ids:
                        tenant_name = log['tenants']['first_name'] if log.get('tenants') else 'Unknown'
                        
                        if log['action'] == 'entry_granted':
                            print(f"🟢 GATE OPENING FOR: {tenant_name} (Log ID: {log['id']})")
                        elif log['action'] == 'entry_denied':
                            print(f"🔴 ACCESS DENIED FOR: {tenant_name} (Log ID: {log['id']})")
                        
                        processed_log_ids.add(log['id'])

        except Exception:
            print("An error occurred during polling. Full traceback:")
            traceback.print_exc()

        await asyncio.sleep(2)

async def main():
    await poll_gate_logs()

if __name__ == "__main__":
    asyncio.run(main())