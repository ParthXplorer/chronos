from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, stocks, orders, analytics, portfolio, admin
from app.websocket import broadcast_loop
from app.engine_bridge import reload_open_orders, shutdown_engine, ping
from app.database import SessionLocal
import asyncio
import logging
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    # 1. Verify the C++ engine is reachable
    if ping():
        log.info("Matching engine: online")
    else:
        log.warning("Matching engine: not responding — orders will queue without matching")

    # 2. Replay open orders so the in-memory book matches the DB
    db = SessionLocal()
    try:
        n = reload_open_orders(db)
        log.info("Loaded %d open orders into engine book", n)
    except Exception as exc:
        log.error("Failed to reload open orders: %s", exc)
    finally:
        db.close()

    # 3. Start the WebSocket broadcast loop
    task = asyncio.create_task(broadcast_loop())

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    shutdown_engine()

app = FastAPI(
    title="Chronos Exchange API",
    description="A low-latency stock exchange backend",
    version="1.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(orders.router)
app.include_router(analytics.router)
app.include_router(portfolio.router)
app.include_router(admin.router)   # was missing

@app.get("/")
def root():
    return {"message": "Chronos Exchange API is running"}