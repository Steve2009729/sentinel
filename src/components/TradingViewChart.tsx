"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  ColorType,
} from "lightweight-charts";
import type { OHLCVCandle } from "@/lib/types";
import { theme } from "@/lib/theme";

interface TradingViewChartProps {
  candles: OHLCVCandle[];
  symbol: string;
  height?: number;
}

export default function TradingViewChart({ candles, symbol, height = 300 }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: theme.muted,
        fontSize: 11,
        fontFamily: "var(--font-geist-mono), monospace",
      },
      grid: {
        vertLines: { color: "rgba(28,31,53,0.25)" },
        horzLines: { color: "rgba(28,31,53,0.25)" },
      },
      crosshair: {
        vertLine: { color: `${theme.accent}60`, width: 1 },
        horzLine: { color: `${theme.accent}60`, width: 1 },
      },
      rightPriceScale: {
        borderColor: theme.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: theme.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // ─── AREA / LINE series (not candlestick) ─────────────────────
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: theme.accent,
      topColor: `${theme.accent}30`,
      bottomColor: `${theme.accent}04`,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: theme.accent,
      crosshairMarkerBackgroundColor: theme.panel,
    });

    // Volume histogram
    const volSeries = chart.addSeries(HistogramSeries, {
      color: theme.chartVolume,
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // Use close price for line
    const lineData = candles.map((c) => ({ time: c.time as any, value: c.close }));
    const volData = candles.map((c) => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? `${theme.chartGreen}28` : `${theme.chartRed}28`,
    }));

    areaSeries.setData(lineData);
    volSeries.setData(volData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, height]);

  // Determine price trend
  const priceTrend = candles.length >= 2
    ? candles[candles.length - 1].close - candles[0].close
    : 0;
  const trendColor = priceTrend >= 0 ? theme.enter : theme.danger;
  const trendPct = candles.length >= 2 && candles[0].close > 0
    ? ((priceTrend / candles[0].close) * 100).toFixed(2)
    : "0.00";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
          {symbol} · Price (30m)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: trendColor, fontFamily: "var(--font-geist-mono), monospace" }}>
            {priceTrend >= 0 ? "▲" : "▼"} {trendPct}%
          </span>
          <div className="live-dot" />
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ width: "100%", borderRadius: 10, overflow: "hidden", border: `1px solid ${theme.border}`, background: theme.panel }}
      />
      {candles.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 0", color: theme.muted, fontSize: 12 }}>
          No chart data available
        </div>
      )}
    </div>
  );
}
