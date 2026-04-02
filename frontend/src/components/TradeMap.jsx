import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";

// TopoJSON file for the world map landmasses
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Map real stocks from your DB to global hubs
const STOCK_LOCATIONS = {
  AAPL: { name: "New York", coordinates: [-74.0060, 40.7128] }, // [Longitude, Latitude] for 2D maps
  GOOGL: { name: "New York", coordinates: [-74.0060, 40.7128] },
  TSLA: { name: "New York", coordinates: [-74.0060, 40.7128] },
  MSFT: { name: "New York", coordinates: [-74.0060, 40.7128] },
  INFY: { name: "Mumbai", coordinates: [72.8777, 19.0760] },
  HDFCBANK: { name: "Mumbai", coordinates: [72.8777, 19.0760] },
  ICICIBANK: { name: "Mumbai", coordinates: [72.8777, 19.0760] },
  TCS: { name: "Mumbai", coordinates: [72.8777, 19.0760] },
  RELIANCE: { name: "Mumbai", coordinates: [72.8777, 19.0760] },
};

// Central routing server (London)
const CHRONOS_SERVER = { name: "Chronos Core", coordinates: [-0.1278, 51.5074] };

export default function TradeMap() {
  const [activeTrades, setActiveTrades] = useState([]);

  useEffect(() => {
    // Connect to the Chronos Backend WebSocket
    const ws = new WebSocket("ws://localhost:8000/ws"); 

    ws.onopen = () => console.log("2D Map connected to Chronos Live Engine");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "TRADE" || data.event === "trade") {
          const symbol = data.symbol || data.Symbol;
          const isBuy = data.side === "Buy"; 
          
          const destination = STOCK_LOCATIONS[symbol] || STOCK_LOCATIONS["AAPL"];
          const tradeColor = isBuy ? "#10b981" : "#ef4444"; // Green for Buy, Red for Sell

          const newTrade = {
            id: Date.now() + Math.random(), // Unique ID for React keys
            from: CHRONOS_SERVER.coordinates,
            to: destination.coordinates,
            color: tradeColor
          };

          // Add trade line, then remove it after 1.5 seconds to create a "flash" effect
          setActiveTrades(prev => [...prev, newTrade]);
          setTimeout(() => {
            setActiveTrades(prev => prev.filter(t => t.id !== newTrade.id));
          }, 10000);
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    return () => ws.close();
  }, []);

  // Extract unique hub coordinates to draw the static nodes
  const uniqueHubs = Array.from(
    new Set(Object.values(STOCK_LOCATIONS).map(loc => JSON.stringify(loc)))
  ).map(str => JSON.parse(str));
  uniqueHubs.push(CHRONOS_SERVER);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>LIVE NETWORK TOPOLOGY</h2>
        <div style={styles.legend}>
          <span style={styles.legendItem}><span style={{...styles.dot, background: '#10b981'}}></span> BUY</span>
          <span style={styles.legendItem}><span style={{...styles.dot, background: '#ef4444'}}></span> SELL</span>
          <span style={styles.legendItem}><span style={{...styles.dot, background: '#f0b429'}}></span> NODE</span>
        </div>
      </div>
      
      <div style={styles.mapWrapper}>
        <ComposableMap
          projection="geoMercator" // Flat map projection
          projectionConfig={{ scale: 130, center: [0, 20] }} // Centers the map nicely
          style={{ width: "100%", height: "100%" }}
        >
          {/* 1. Draw the Landmasses */}
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0c1624" // Very dark blue for land
                  stroke="#1e293b" // Slate border
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#132338", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {/* 2. Draw the Active Trade Lines */}
          {activeTrades.map((trade) => (
            <Line
              key={trade.id}
              from={trade.from}
              to={trade.to}
              stroke={trade.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              style={{
                opacity: 0.8,
                filter: `drop-shadow(0px 0px 4px ${trade.color})` // CSS Glow effect
              }}
            />
          ))}

          {/* 3. Draw the Financial Hub Nodes */}
          {uniqueHubs.map((hub, i) => (
            <Marker key={i} coordinates={hub.coordinates}>
              <circle 
                r={hub.name === "Chronos Core" ? 4 : 3} 
                fill={hub.name === "Chronos Core" ? "#ffffff" : "#f0b429"} 
                style={{ filter: "drop-shadow(0px 0px 3px rgba(240, 180, 41, 0.8))" }}
              />
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </div>
  );
}

const styles = {
  container: { width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#08101a", borderRadius: "4px", border: "1px solid rgba(240,180,41,0.15)", overflow: "hidden" },
  header: { padding: "16px", borderBottom: "1px solid rgba(240,180,41,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", flexShrink: 0 },
  title: { margin: 0, fontSize: "14px", color: "#f0b429", letterSpacing: "2px", fontWeight: 700 },
  legend: { display: "flex", gap: "16px" },
  legendItem: { fontSize: "10px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px", letterSpacing: "1px" },
  dot: { width: "8px", height: "8px", borderRadius: "50%" },
  mapWrapper: { flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }
};