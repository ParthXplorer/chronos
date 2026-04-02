import requests
import concurrent.futures
import time

# Assuming your backend runs on localhost:8000
API_URL = "http://localhost:8000/orders/"
AUTH_TOKEN = "your_test_user_jwt_token_here" 

headers = {
    "Authorization": f"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNSIsImV4cCI6MTc3NDg5NjM1N30.j8vrRkhxSTXmThKDZFld8Wwf9riSB_XYt7rvps6yQFw",
    "Content-Type": "application/json"
}

# Payload for a conflicting transaction (e.g., repeatedly buying the same stock rapidly)
# Updated to match OrderCreate schema in schemas.py
order_payload = {
    "symbol": "AAPL",
    "side": "Buy",      # Must be exactly "Buy" (case-sensitive due to your router validation)
    "type": "Market",   # Must be exactly "Market"
    "quantity": 10
    # limit_price is omitted because it's a Market order
    # user_id is omitted because your backend extracts it from the JWT token
}

def place_order():
    try:
        response = requests.post(API_URL, json=order_payload, headers=headers)
        # Return the actual error message if it fails, making debugging much easier
        if response.status_code != 201:
             return f"Error {response.status_code}: {response.text}"
        return response.status_code
    except Exception as e:
        return str(e)

print("Starting concurrent transaction bombardment...")
start_time = time.time()

# Send 20 conflicting requests at the exact same time
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    results = list(executor.map(lambda _: place_order(), range(20)))

print(f"Finished in {time.time() - start_time:.2f} seconds.")
print(f"Results: {results}")
print("Check your database: Wallet balance should be exactly deduced by 20x the market price, with no dropped transactions.")