'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import recharts components
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((mod) => mod.Line), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
const Sankey = dynamic(() => import('recharts').then((mod) => mod.Sankey), { ssr: false });
const RechartsTooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const ScatterChart = dynamic(() => import('recharts').then((mod) => mod.ScatterChart), { ssr: false });
const Scatter = dynamic(() => import('recharts').then((mod) => mod.Scatter), { ssr: false });

// Export the dynamically imported components
export {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Sankey,
  RechartsTooltip,
  ScatterChart,
  Scatter,
};