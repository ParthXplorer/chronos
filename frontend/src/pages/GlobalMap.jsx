import { useEffect, useRef, useState } from "react";
import { STOCK_LOCATIONS } from "../data/stockLocations";

const SECTOR_COLORS = {
  Technology: "#38bdf8",
  Banking:    "#a78bfa",
  Automotive: "#f59e0b",
  Healthcare: "#34d399",
  Energy:     "#fb923c",
};

function getChangeColor(stock) {
  const ltp       = parseFloat(stock.LTP);
  const prevClose = parseFloat(stock.Prev_Close);
  if (!prevClose || prevClose === 0) return "#f0b429";
  return ltp >= prevClose ? "#10b981" : "#f43f5e";
}

function getChangePct(stock) {
  const ltp       = parseFloat(stock.LTP);
  const prevClose = parseFloat(stock.Prev_Close);
  if (!prevClose || prevClose === 0) return null;
  return ((ltp - prevClose) / prevClose) * 100;
}

export default function GlobalMap({ stocks = [], onSelectSymbol }) {
  const svgRef     = useRef(null);
  const [tooltip,  setTooltip]  = useState(null);
  const [filter,   setFilter]   = useState("ALL");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const enriched = stocks
    .map(s => ({ ...s, ...(STOCK_LOCATIONS[s.Symbol] ?? null) }))
    .filter(s => s.lat !== undefined);

  const sectors = ["ALL", ...new Set(enriched.map(s => s.Sector).filter(Boolean))];
  const visible  = filter === "ALL" ? enriched : enriched.filter(s => s.Sector === filter);

  const gainingCount   = enriched.filter(s => (getChangePct(s) ?? 0) >= 0).length;
  const decliningCount = enriched.length - gainingCount;

  useEffect(() => {
    if (!svgRef.current) return;
    if (window.d3 && window.topojson) { drawMap(); return; }

    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s2.onload  = () => drawMap();
      s2.onerror = () => setMapError(true);
      document.head.appendChild(s2);
    };
    s1.onerror = () => setMapError(true);
    document.head.appendChild(s1);
  }, []);

  useEffect(() => {
    if (mapReady) drawBubbles();
  }, [visible, mapReady]);

  function drawMap() {
    const d3   = window.d3;
    const topo = window.topojson;
    if (!d3 || !topo || !svgRef.current) return;

    const W = svgRef.current.clientWidth  || 900;
    const H = svgRef.current.clientHeight || 460;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3.geoNaturalEarth1()
      .scale(W / 5)
      .translate([W / 2, H / 2 + 20]);

    const path = d3.geoPath().projection(projection);

    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#05080f");

    const graticule = d3.geoGraticule()();
    svg.append("path").datum(graticule)
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.03)")
      .attr("stroke-width", 0.4);

    svg.append("path").datum({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "rgba(240,180,41,0.07)")
      .attr("stroke-width", 0.8);

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(world => {
        const countries = topo.feature(world, world.objects.countries);
        svg.selectAll(".country")
          .data(countries.features)
          .join("path")
          .attr("class", "country")
          .attr("d", path)
          .attr("fill", "#0d1e32")
          .attr("stroke", "#1a3050")
          .attr("stroke-width", 0.4);

        svg.append("g").attr("class", "bubbles-layer");
        svgRef.current._projection = projection;
        setMapReady(true);
      })
      .catch(() => setMapError(true));
  }

function drawBubbles() {
    const d3 = window.d3;
    if (!d3 || !svgRef.current?._projection) return;

    const projection = svgRef.current._projection;
    const svg   = d3.select(svgRef.current);
    const layer = svg.select(".bubbles-layer");
    layer.selectAll("*").remove();

    const BUBBLE_R = 8;

    // 1. Calculate target coordinates for all stocks
    const nodes = visible.map(s => {
      const coords = projection([s.lon, s.lat]);
      if (!coords || isNaN(coords[0])) return null;
      // tx/ty are target locations. x/y are current locations.
      return { ...s, tx: coords[0], ty: coords[1], x: coords[0], y: coords[1] };
    }).filter(Boolean);

    // 2. MAGIC FIX: D3 Force Simulation to prevent overlap!
    // This pushes bubbles away from each other if they are closer than their radius
    d3.forceSimulation(nodes)
      .force("x", d3.forceX(d => d.tx).strength(0.8))
      .force("y", d3.forceY(d => d.ty).strength(0.8))
      .force("collide", d3.forceCollide(BUBBLE_R + 3).iterations(4))
      .stop()
      .tick(60); // Run the math instantly before drawing

    // 3. Draw the properly spaced bubbles
    nodes.forEach((s, i) => {
      const px = s.x; // Use the collision-adjusted X
      const py = s.y; // Use the collision-adjusted Y
      const color = getChangeColor(s);
      const pct   = getChangePct(s);

      const g = layer.append("g")
        .attr("class", "map-bubble")
        .attr("data-sym", s.Symbol)
        .attr("transform", `translate(${px},${py})`)
        .style("cursor", "pointer")
        .on("mouseenter", () => setTooltip({ stock: s, pct, x: px, y: py }))
        .on("mouseleave", () => setTooltip(null))
        .on("click",      () => onSelectSymbol?.(s.Symbol));

      // glow rings
      g.append("circle").attr("r", BUBBLE_R + 7).attr("fill", color).attr("opacity", 0.07);
      g.append("circle").attr("r", BUBBLE_R + 2).attr("fill", color).attr("opacity", 0.13);

      // main bubble
      g.append("circle")
        .attr("r", BUBBLE_R)
        .attr("fill", color)
        .attr("opacity", 0.85)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8)
        .attr("stroke-opacity", 0.2);

      // symbol text
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", s.Symbol.length > 5 ? 6 : 7)
        .attr("font-family", "IBM Plex Mono, monospace")
        .attr("font-weight", "600")
        .attr("fill", "#fff")
        .attr("pointer-events", "none")
        .text(s.Symbol.length > 7 ? s.Symbol.slice(0, 6) : s.Symbol);

      // city label below bubble
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", BUBBLE_R + 10)
        .attr("font-size", 7)
        .attr("font-family", "IBM Plex Mono, monospace")
        .attr("fill", "#3a5070")
        .attr("pointer-events", "none")
        .text(s.city?.split(",")[0] ?? "");

      // staggered fade-in
      // g.style("opacity", 0)
      //   .transition()
      //   .delay(i * 55)
      //   .duration(30)
      //   .style("opacity", 1);
    });
  }

  return (
    <div style={s.page}>
      <div style={s.statsRow}>
        {[
          { label: "ON MAP",    val: enriched.length,    color: "var(--amber)" },
          { label: "GAINING",   val: gainingCount,       color: "var(--green)" },
          { label: "DECLINING", val: decliningCount,     color: "var(--red)"   },
          { label: "SECTORS",   val: sectors.length - 1, color: "var(--blue)"  },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.statCard}>
            <div style={s.statLabel}>{label}</div>
            <div style={{ ...s.statVal, color }}>{val}</div>
          </div>
        ))}

        <div style={s.filterRow}>
          {sectors.map(sec => (
            <button
              key={sec}
              style={filter === sec ? s.filterActive : s.filterBtn}
              onClick={() => setFilter(sec)}
            >
              {sec === "ALL" ? "ALL" : sec.slice(0, 4).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={s.mapContainer}>
        {mapError && (
          <div style={s.errorOverlay}>
            <div style={s.errorText}>⚠ MAP UNAVAILABLE — CDN BLOCKED</div>
            <div style={s.errorSub}>Open in a browser with internet access</div>
          </div>
        )}

        <svg ref={svgRef} style={s.svg} width="100%" height="100%" />

        {tooltip && (() => {
          const { stock, pct } = tooltip;
          const up    = (pct ?? 0) >= 0;
          const color = getChangeColor(stock);
          const W     = svgRef.current?.clientWidth  ?? 800;
          const H     = svgRef.current?.clientHeight ?? 460;
          const left  = Math.min(Math.max(tooltip.x + 20, 4), W - 216);
          const top   = Math.min(Math.max(tooltip.y - 80, 4), H - 210);
          return (
            <div style={{ ...s.tooltip, left, top }}>
              <div style={s.ttSector}>{stock.Sector?.toUpperCase()}</div>
              <div style={{ ...s.ttSym, color }}>{stock.Symbol}</div>
              <div style={s.ttCity}>📍 {stock.city}, {stock.country}</div>
              <div style={s.ttDivider} />
              <div style={s.ttRow}>
                <div>
                  <div style={s.ttSubLabel}>LTP</div>
                  <div style={s.ttPrice}>₹ {parseFloat(stock.LTP).toFixed(2)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={s.ttSubLabel}>CHANGE</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                    {pct !== null ? `${up ? "+" : ""}${pct.toFixed(2)}%` : "—"}
                  </div>
                </div>
              </div>
              <div style={s.ttRow}>
                <div>
                  <div style={s.ttSubLabel}>PREV CLOSE</div>
                  <div style={{ fontSize: "11px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                    ₹ {parseFloat(stock.Prev_Close || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={s.ttSubLabel}>STATUS</div>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", color: stock.Status === "Active" ? "var(--green)" : "var(--red)" }}>
                    {stock.Status?.toUpperCase()}
                  </div>
                </div>
              </div>
              <button
                style={{ ...s.ttBtn, background: color }}
                onClick={() => onSelectSymbol?.(stock.Symbol)}
              >
                VIEW ORDER BOOK →
              </button>
            </div>
          );
        })()}

        {/* <div style={s.legend}>
          {[
            { color: "var(--green)", label: "GAINING  (LTP ≥ PREV CLOSE)" },
            { color: "var(--red)",   label: "DECLINING (LTP < PREV CLOSE)" },
            { color: "var(--amber)", label: "NO PREV CLOSE DATA YET" },
          ].map(({ color, label }) => (
            <div key={label} style={s.legendItem}>
              <span style={{ ...s.legendDot, background: color }} />
              <span style={s.legendLabel}>{label}</span>
            </div>
          ))}
        </div> */}

        <div style={s.cornerTag}>CHRONOS EXCHANGE · GLOBAL MARKET MAP</div>
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", flexDirection: "column", gap: "12px", height: "100%" },

  statsRow: { display: "flex", gap: "8px", alignItems: "stretch", flexShrink: 0 },
  statCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    flex: 1,
    minWidth: 0,
  },
  statLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2.5px", marginBottom: "5px" },
  statVal: { fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 800, letterSpacing: "1px" },

  filterRow: { display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 },
  filterBtn: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    color: "var(--text-4)",
    padding: "5px 10px",
    fontSize: "8px",
    letterSpacing: "1.5px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
    whiteSpace: "nowrap",
  },
  filterActive: {
    background: "var(--amber-dim)",
    border: "1px solid var(--border-amber)",
    color: "var(--amber)",
    padding: "5px 10px",
    fontSize: "8px",
    letterSpacing: "1.5px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    borderRadius: "var(--radius-sm)",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  mapContainer: {
    flex: 1,
    background: "var(--bg-card)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    position: "relative",
    minHeight: "360px",
  },
  svg: { display: "block", position: "absolute", inset: 0 },

  errorOverlay: {
    position: "absolute", inset: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    zIndex: 10, background: "var(--bg-card)",
  },
  errorText: { fontSize: "12px", color: "var(--amber)", letterSpacing: "2px", fontWeight: 600 },
  errorSub:  { fontSize: "10px", color: "var(--text-4)", marginTop: "8px" },

  tooltip: {
    position: "absolute",
    background: "var(--bg-3)",
    border: "1px solid var(--border-amber)",
    borderRadius: "var(--radius-md)",
    padding: "12px 14px",
    zIndex: 20,
    width: "208px",
    pointerEvents: "none",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  },
  ttSector:   { fontSize: "7px", color: "var(--text-4)", letterSpacing: "3px", marginBottom: "2px" },
  ttSym:      { fontSize: "16px", fontWeight: 700, letterSpacing: "2px", lineHeight: 1, marginBottom: "3px" },
  ttCity:     { fontSize: "9px", color: "var(--text-4)", marginBottom: "8px" },
  ttDivider:  { height: "1px", background: "var(--border-dim)", marginBottom: "8px" },
  ttRow:      { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  ttSubLabel: { fontSize: "7px", color: "var(--text-4)", letterSpacing: "2px", marginBottom: "2px" },
  ttPrice:    { fontSize: "14px", color: "var(--text-0)", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  ttBtn: {
    width: "100%",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "7px",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "2px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    color: "#05080f",
    pointerEvents: "all",
    marginTop: "2px",
  },

  legend: {
    position: "absolute",
    bottom: "12px",
    left: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    background: "rgba(5,8,15,0.82)",
    border: "1px solid var(--border-dim)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 12px",
  },
  legendItem:  { display: "flex", alignItems: "center", gap: "6px" },
  legendDot:   { width: "8px", height: "8px", borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  legendLabel: { fontSize: "8px", color: "var(--text-3)", letterSpacing: "0.5px" },

  cornerTag: {
    position: "absolute", bottom: "12px", right: "14px",
    fontSize: "7px", color: "var(--text-5)", letterSpacing: "2px",
  },
};