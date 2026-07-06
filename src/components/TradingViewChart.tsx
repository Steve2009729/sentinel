"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";
import type { OHLCVCandle } from "@/lib/types";
import { theme } from "@/lib/theme";

interface TradingViewChartProps {
  candles: OHLCVCandle[];
  symbol: string;
  height?: number;
}

export default function TradingViewChart({
  candles,
  symbol,
  height = 320,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart
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
        vertLines: { color: "rgba(28, 31, 53, 0.3)" },
        horzLines: { color: "rgba(28, 31, 53, 0.3)" },
      },
      crosshair: {
        vertLine: { color: `${theme.accent}50`, width: 1 },
        horzLine: { color: `${theme.accent}50`, width: 1 },
      },
      rightPriceScale: {
        borderColor: theme.border,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: theme.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series (v5 API: chart.addSeries(SeriesDefinition, options))
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: theme.chartGreen,
      downColor: theme.chartRed,
      borderUpColor: theme.chartGreen,
      borderDownColor: theme.chartRed,
      wickUpColor: `${theme.chartGreen}99`,
      wickDownColor: `${theme.chartRed}99`,
    });

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: theme.chartVolume,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Set data
    if (candles.length > 0) {
      const candleData = candles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volumeData = candles.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? `${theme.chartGreen}30` : `${theme.chartRed}30`,
      }));

      candleSeries.setData(candleData);
      volumeSeries.setData(volumeData);
      chart.timeScale().fitContent();
    }

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
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

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
          {symbol} · 30m Chart
        </div>
        <div className="live-dot" />
      </div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${theme.border}`,
          background: theme.panel,
        }}
      />
    </div>
  );
}
