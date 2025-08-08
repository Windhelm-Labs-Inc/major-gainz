import React, { useEffect, useMemo, useState } from 'react';

interface Candle {
  t: number; // epoch seconds or ms
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

interface CandlestickChartProps {
  symbol: string; // token symbol, e.g., HBAR
  days?: number;
  height?: number;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ symbol, days = 90, height = 420 }) => {
  const [data, setData] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ohlcv/${encodeURIComponent(symbol)}?days=${days}&interval=DAY`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        const mapped: Candle[] = (json || []).map((r: any) => ({
          t: (r.timestamp ?? r.time ?? r.ts ?? Date.parse(r.date)) || 0,
          o: Number(r.open),
          h: Number(r.high),
          l: Number(r.low),
          c: Number(r.close),
          v: r.volume != null ? Number(r.volume) : undefined,
        })).filter((c: Candle) => isFinite(c.o) && isFinite(c.h) && isFinite(c.l) && isFinite(c.c));
        if (!canceled) {
          setData(mapped);
          setError(null);
        }
      } catch (e: any) {
        if (!canceled) {
          setError(e?.message || 'Failed to load candles');
          setData([]);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => { canceled = true; };
  }, [symbol, days]);

  const width = 800;
  const topPadding = 12;
  const bottomPadding = 24;
  const leftPadding = 44;
  const rightPadding = 12;

  const { minPrice, maxPrice } = useMemo(() => {
    if (!data.length) return { minPrice: 0, maxPrice: 1 };
    let minP = Infinity, maxP = -Infinity;
    for (const d of data) {
      if (d.l < minP) minP = d.l;
      if (d.h > maxP) maxP = d.h;
    }
    if (!isFinite(minP) || !isFinite(maxP) || minP >= maxP) return { minPrice: 0, maxPrice: 1 };
    return { minPrice: minP, maxPrice: maxP };
  }, [data]);

  // Simple inline renderer using SVG for clarity
  const svg = useMemo(() => {
    if (!data.length) return null;
    const innerW = width - leftPadding - rightPadding;
    const innerH = height - topPadding - bottomPadding;
    const n = data.length;
    const step = innerW / Math.max(1, n);

    const yFor = (p: number) => {
      const ratio = (p - minPrice) / (maxPrice - minPrice);
      return topPadding + innerH - ratio * innerH;
    };

    const bars: React.ReactNode[] = [];
    data.forEach((d, i) => {
      const x = leftPadding + i * step + step * 0.1;
      const barW = step * 0.8;
      const color = d.c >= d.o ? '#16a34a' : '#dc2626';
      // Wick
      bars.push(
        <line key={`w-${i}`} x1={x + barW / 2} x2={x + barW / 2} y1={yFor(d.h)} y2={yFor(d.l)} stroke={color} strokeWidth={1} />
      );
      // Body
      const yOpen = yFor(d.o);
      const yClose = yFor(d.c);
      const yTop = Math.min(yOpen, yClose);
      const yBot = Math.max(yOpen, yClose);
      const rectH = Math.max(1, yBot - yTop);
      bars.push(
        <rect key={`b-${i}`} x={x} y={yTop} width={barW} height={rectH} fill={color} rx={2} ry={2} />
      );
    });

    // Axes (minimal)
    const axisColor = '#94a3b8';
    const priceLabels: React.ReactNode[] = [];
    for (let k = 0; k <= 4; k++) {
      const p = minPrice + (k * (maxPrice - minPrice)) / 4;
      const y = yFor(p);
      priceLabels.push(
        <g key={`g-${k}`}> 
          <line x1={leftPadding} x2={width - rightPadding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 5" />
          <text x={6} y={y + 4} fontSize="11" fill={axisColor}>${p.toFixed(4)}</text>
        </g>
      );
    }

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Title */}
        <text x={leftPadding} y={16} fontSize="14" fontWeight={600} fill="#0f172a">{symbol} — Daily Candles ({days}d)</text>
        {priceLabels}
        {bars}
      </svg>
    );
  }, [data, width, height, minPrice, maxPrice, symbol, days]);

  if (loading && !data.length) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mg-gray-600)' }}>Loading candles…</div>;
  }
  if (error) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>Failed to load: {error}</div>;
  }
  if (!data.length) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mg-gray-600)' }}>No candle data</div>;
  }

  return (
    <div style={{ height, padding: '16px', background: 'white', border: '1px solid var(--mg-gray-200)', borderRadius: 'var(--mg-radius-md)' }}>
      {svg}
    </div>
  );
};

export default CandlestickChart;


