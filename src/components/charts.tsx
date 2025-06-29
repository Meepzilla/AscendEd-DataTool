'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// This file is used to dynamically import and re-export various charting components from the 'recharts' library.
// Dynamic imports (`next/dynamic`) are used to ensure that these potentially large charting libraries
// are only loaded when they are actually needed by a component, improving initial page load performance.

// -- Recharts Components Dynamic Imports --
// Each chart component is imported dynamically with `ssr: false` to ensure it only renders on the client side,
// as some charting libraries might rely on browser-specific APIs.

// Dynamically import the Bar component from recharts.
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
// Dynamically import the BarChart component from recharts.
const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
// Dynamically import the CartesianGrid component from recharts.
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
// Dynamically import the XAxis component from recharts.
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
// Dynamically import the YAxis component from recharts.
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
// Dynamically import the ResponsiveContainer component from recharts.
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });
// Dynamically import the LineChart component from recharts.
const LineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart), { ssr: false });
// Dynamically import the Line component from recharts.
const Line = dynamic(() => import('recharts').then((mod) => mod.Line), { ssr: false });
// Dynamically import the Legend component from recharts.
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
// Dynamically import the Sankey component from recharts.
const Sankey = dynamic(() => import('recharts').then((mod) => mod.Sankey), { ssr: false });
// Dynamically import the Tooltip component from recharts (aliased to RechartsTooltip to avoid name collision).
const RechartsTooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
// Dynamically import the ScatterChart component from recharts.
const ScatterChart = dynamic(() => import('recharts').then((mod) => mod.ScatterChart), { ssr: false });
// Dynamically import the Scatter component from recharts.
const Scatter = dynamic(() => import('recharts').then((mod) => mod.Scatter), { ssr: false });

// -- Exported Components --
// Re-export all the dynamically imported charting components.
// This allows other parts of the application to import them from this central file,
// leveraging dynamic loading without needing to implement `dynamic()` in every consuming component.
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
