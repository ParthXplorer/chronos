from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, stocks, orders

app = FastAPI(
    title="Chronos Exchange API",
    description="A low-latency stock exchange backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(orders.router)

@app.get("/")
def root():
    return {"message": "Chronos Exchange API is running"}