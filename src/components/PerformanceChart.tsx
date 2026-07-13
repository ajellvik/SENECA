import React, { useState } from 'react';
import { PortfolioHistory } from '../types';
import { TrendingUp, Award, Calendar, Info } from 'lucide-react';

interface PerformanceChartProps {
  historyPoints: PortfolioHistory[];
  portfolioName: string;
}

export default function PerformanceChart({ historyPoints, portfolioName }: PerformanceChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<PortfolioHistory | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (historyPoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-stone-405 border border-stone-200 rounded bg-[#faf9f6]">
        <Info className="h-5 w-5 text-stone-350 mb-2.5" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-700 font-mono">No Historical Data Registered</p>
        <p className="text-xs text-stone-400 mt-1 font-serif italic">Performance history metrics will appear here once updates are recorded on the server.</p>
      </div>
    );
  }

  // Calculate return details
  const startVal = historyPoints[0].index_value;
  const currentVal = historyPoints[historyPoints.length - 1].index_value;
  const totalReturnPct = startVal > 0 ? ((currentVal - startVal) / startVal) * 100 : 0;
  const isPositive = totalReturnPct >= 0;

  // Chart plotting helpers (SVG coordinates)
  const width = 800;
  const height = 280;
  const paddingX = 40;
  const paddingY = 30;

  const minVal = Math.min(...historyPoints.map(p => p.index_value)) * 0.98;
  const maxVal = Math.max(...historyPoints.map(p => p.index_value)) * 1.02;
  const valueRange = maxVal - minVal || 1;

  const getX = (index: number) => {
    if (historyPoints.length <= 1) return width / 2;
    return paddingX + (index * (width - 2 * paddingX)) / (historyPoints.length - 1);
  };

  const getY = (value: number) => {
    return height - paddingY - ((value - minVal) * (height - 2 * paddingY)) / valueRange;
  };

  // Build the SVG Path points
  const points = historyPoints.map((p, idx) => ({
    x: getX(idx),
    y: getY(p.index_value),
    original: p
  }));

  const linePath = points.reduce((path, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
  }, '');

  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
    : '';

  // Get active point description to display below chart
  const activePoint = hoveredPoint || historyPoints[historyPoints.length - 1];

  return (
    <div id="interactive-performance-chart" className="bg-white border border-stone-200 rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.01)] font-sans text-stone-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-rg-orange font-bold bg-rg-clay-light border border-rg-orange/25 px-3 py-1 rounded-full font-mono">
            Model Performance Index (TWR)
          </span>
          <h3 className="text-lg font-bold text-stone-900 mt-2.5">
            {portfolioName}
          </h3>
          <p className="text-[10px] text-stone-450 font-mono tracking-wide mt-1">
            Cumulative standardized weekly index value (Reference Inception: 100.00)
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[8px] uppercase tracking-widest font-mono text-stone-400 block font-bold">RETURNS SINCE INCEPTION</span>
          <div className="flex sm:justify-end items-baseline gap-1.5 mt-1">
            <span className={`text-xl font-mono font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? '+' : ''}{totalReturnPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-stone-405 font-mono">({currentVal.toFixed(1)} level)</span>
          </div>
        </div>
      </div>

      {/* SVG Container wrapping the chart */}
      <div className="relative mt-2">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none font-sans"
          onMouseLeave={() => {
            setHoveredPoint(null);
            setHoveredIndex(null);
          }}
        >
          {/* Subtle Roland Garros terracotta gradient definitions */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c35232" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#c35232" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c35232" />
              <stop offset="100%" stopColor="#a63f22" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line 
            x1={paddingX} 
            y1={getY(100)} 
            x2={width - paddingX} 
            y2={getY(100)} 
            stroke="#e7e5e4" 
            strokeWidth="1" 
            strokeDasharray="4 4" 
          />
          <text 
            x={width - paddingX + 8} 
            y={getY(100) + 3} 
            fill="#a8a29e" 
            className="text-[8px] font-mono uppercase tracking-wider font-bold"
          >
            START (100)
          </text>

          {/* Area under line */}
          {points.length > 0 && (
            <path d={areaPath} fill="url(#areaGradient)" />
          )}

          {/* Refined clean slate line */}
          {points.length > 0 && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="url(#lineGradient)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {/* Hover guidance vertical slider line */}
          {hoveredIndex !== null && (
            <line 
              x1={getX(hoveredIndex)} 
              y1={paddingY} 
              x2={getX(hoveredIndex)} 
              y2={height - paddingY} 
              stroke="#d6d3d1" 
              strokeWidth="1" 
              strokeDasharray="2 2"
            />
          )}

          {/* Data Points (circles) */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <circle
                key={p.original.id}
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5.5 : 3.5}
                fill={isHovered ? '#c35232' : '#ffffff'}
                stroke={isHovered ? '#ffffff' : '#c35232'}
                strokeWidth={isHovered ? 2.5 : 1.8}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => {
                  setHoveredPoint(p.original);
                  setHoveredIndex(idx);
                }}
              />
            );
          })}
        </svg>

        {/* Floating Dynamic Tooltip inside the chart frame */}
        {hoveredPoint && (
          <div 
            className="absolute z-10 pointer-events-none bg-white border border-stone-250 p-3 rounded-xl shadow-lg text-xs max-w-[220px] text-stone-900"
            style={{
              left: `${Math.min(Math.max((getX(hoveredIndex!) / width) * 100 - 15, 2), 75)}%`,
              top: '10px'
            }}
          >
            <div className="font-bold text-stone-500 font-mono tracking-wide">{hoveredPoint.timestamp}</div>
            <div className="text-stone-900 font-black mt-1 text-sm font-mono">{hoveredPoint.index_value.toFixed(2)} index</div>
            {hoveredPoint.note && (
              <div className="text-[10px] text-stone-500 mt-1.5 leading-relaxed italic border-t border-stone-100 pt-1.5">
                "{hoveredPoint.note}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid under chart containing info about the hovered point / last updated point */}
      <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4 bg-stone-50/50 p-4 rounded-2xl border border-stone-150 flex items-start gap-3">
          <Calendar className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
          <div className="text-left">
            <div className="text-[8px] uppercase font-bold tracking-widest text-stone-400 font-mono">Report Date</div>
            <div className="font-bold text-stone-900 mt-0.5 font-mono text-xs">{activePoint.timestamp}</div>
            <p className="text-[10px] text-stone-500 mt-1 font-mono">Index level: <span className="text-stone-900 font-bold">{activePoint.index_value.toFixed(1)}</span></p>
          </div>
        </div>

        <div className="md:col-span-8 bg-stone-50/50 p-4 rounded-2xl border border-stone-150 flex items-start gap-3">
          <TrendingUp className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
          <div className="w-full text-left">
            <div className="text-[8px] uppercase font-bold tracking-widest text-stone-400 font-mono">Manager Catalyst Notes for Period</div>
            <p className="text-xs text-stone-605 mt-1 font-serif italic leading-relaxed">
              {activePoint.note ? `"${activePoint.note}"` : '"No performance commentary registered for this period."'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
