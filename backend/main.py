from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, stocks, orders, analytics
from app.websocket import manager, broadcast_loop
import asyncio

# ---------------------------------------------------------------------------
# Lifespan — starts the background WebSocket broadcast task on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start broadcasting; task runs until the server shuts down
    task = asyncio.create_task(broadcast_loop())
    yield
    # Graceful shutdown — cancel the loop
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Chronos Exchange API",
    description="A low-latency stock exchange backend",
    version="1.0.0",
    lifespan=lifespan,
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
app.include_router(analytics.router)

@app.get("/")
def root():
    return {"message": "Chronos Exchange API is running"}