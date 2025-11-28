import requests
import time
import os
from dotenv import load_dotenv

# Load environment variables from the .env file in the parent directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

API_URL = "http://localhost:3000/api/gate/identify"
API_SECRET = os.environ.get("GATE_API_SECRET")

if not API_SECRET:
    raise ValueError("GATE_API_SECRET not found in .env file.")

def main():
    """
    Simulates a license plate recognition camera by taking user input
    and sending it to the identification API endpoint.
    """
    print("📷 LPR CAMERA SIMULATOR [ONLINE]")
    print("-" * 35)
    
    headers = {
        'Authorization': f'Bearer {API_SECRET}',
        'Content-Type': 'application/json',
    }
    
    while True:
        try:
            plate = input("🚗 Enter License Plate (or 'quit' to exit): ")
            if plate.lower() == 'quit':
                print("💤 Shutting down camera simulator.")
                break

            if not plate:
                continue

            print(f"🔬 Identifying '{plate}'...")
            
            start_time = time.time()
            response = requests.post(API_URL, headers=headers, json={"license_plate": plate})
            end_time = time.time()

            response_time = (end_time - start_time) * 1000

            print(f"⚡ Response in {response_time:.0f}ms")

            if response.status_code == 200:
                data = response.json()
                tenant_name = data.get('tenant_name', 'Unknown')
                print(f"✅ ACCESS GRANTED: Welcome, {tenant_name}!")
            elif response.status_code in [403, 404]:
                data = response.json()
                reason = data.get('reason', 'No reason specified.')
                print(f"❌ ACCESS DENIED: {reason}")
            else:
                print(f"⚠️ UNEXPECTED ERROR: Status {response.status_code} - {response.text}")

            print("-" * 35)

        except requests.exceptions.RequestException as e:
            print(f"🔥 API CONNECTION ERROR: Could not connect to the server.")
            print(f"   Please ensure the Next.js server is running at {API_URL}")
            print("-" * 35)
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            break

if __name__ == "__main__":
    main()
