import asyncio
import httpx
import json
from datetime import datetime

# --- CONFIGURATION ---
API_BASE_URL = "http://localhost:8000"
TEST_USER = {"email": "test2@chronos.com", "password": "password123"}
LOG_FILE = "api_concurrency_proof.txt"

def write_log(message: str):
    print(message)
    with open(LOG_FILE, "a") as f:
        f.write(message + "\n")

async def place_order(client: httpx.AsyncClient, token: str, order_id: int):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "symbol": "XTEST",
        "side": "Buy",
        "type": "Limit",
        "limit_price": 100.00,
        "quantity": 90  # Costs $9,000. Wallet has $10,000.
    }
    
    start_time = datetime.now()
    response = await client.post(f"{API_BASE_URL}/orders/", json=payload, headers=headers)
    end_time = datetime.now()
    
    elapsed = (end_time - start_time).total_seconds()
    
    return {
        "req_id": order_id,
        "status": response.status_code,
        "time": elapsed,
        "response": response.json()
    }

async def run_concurrency_test():
    # Clear previous log
    open(LOG_FILE, 'w').close()
    
    write_log("=========================================================")
    write_log(" CHRONOS EXCHANGE - API CONCURRENCY & LOCKING TEST")
    write_log("=========================================================\n")
    
    async with httpx.AsyncClient() as client:
        # 1. Login to get token
        write_log("[SYSTEM] Authenticating test user...")
        login_res = await client.post(f"{API_BASE_URL}/auth/login", data={
            "username": TEST_USER["email"], 
            "password": TEST_USER["password"]
        })
        
        if login_res.status_code != 200:
            write_log("❌ Failed to login. Please check user credentials.")
            return
            
        token = login_res.json().get("access_token")
        write_log("✅ Authenticated successfully.\n")
        
        # 2. Check initial balance
        headers = {"Authorization": f"Bearer {token}"}
        portfolio_res = await client.get(f"{API_BASE_URL}/portfolio/", headers=headers)
        initial_wallet = portfolio_res.json().get("wallet_balance", 0)
        initial_reserved = portfolio_res.json().get("reserved_balance", 0)
        
        write_log(f"[STATE BEFORE TEST] Wallet: ${initial_wallet} | Reserved: ${initial_reserved}")
        write_log("Attempting to place TWO concurrent buy orders for $9,000 each...\n")

        # 3. Fire concurrent requests
        # Both requests will hit the FastAPI endpoint at the exact same millisecond.
        # Without `.with_for_update()`, both would succeed. With it, one must wait and fail.
        write_log("[NETWORK] Firing concurrent requests...")
        tasks = [
            place_order(client, token, 1),
            place_order(client, token, 2)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # 4. Log the API Responses
        success_count = 0
        fail_count = 0
        
        for res in results:
            if res["status"] == 201:
                success_count += 1
                write_log(f"🟢 Request {res['req_id']} SUCCEEDED (Time: {res['time']:.3f}s)")
            else:
                fail_count += 1
                write_log(f"🔴 Request {res['req_id']} FAILED with {res['status']} (Time: {res['time']:.3f}s)")
                write_log(f"   Reason: {res['response'].get('detail')}")

        write_log("\n[ANALYSIS]")
        if success_count == 1 and fail_count == 1:
            write_log("✅ SQLAlchemy Row Locks (.with_for_update) successfully serialized the requests.")
            write_log("✅ Double-spend prevented at the application layer.")
        else:
            write_log("❌ VULNERABILITY DETECTED: Locks failed to prevent double-spend.")

        # 5. Check final balance
        portfolio_res_final = await client.get(f"{API_BASE_URL}/portfolio/", headers=headers)
        final_wallet = portfolio_res_final.json().get("wallet_balance", 0)
        final_reserved = portfolio_res_final.json().get("reserved_balance", 0)
        
        write_log(f"\n[STATE AFTER TEST] Wallet: ${final_wallet} | Reserved: ${final_reserved}")

if __name__ == "__main__":
    asyncio.run(run_concurrency_test())