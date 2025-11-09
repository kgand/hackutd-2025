import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { api } from '../../lib/apiClient';

interface DownDetectorData {
  logo: string;
  url: string;
  problems: {
    app: string;
    website: string;
    server: string;
  };
  comments: Record<string, {
    user: string;
    date: string;
    comment: string;
  }>;
  chart: {
    data: Array<{ x: string; y: number }>;
    baseline: Array<{ x: string; y: number }>;
  };
}

const OutageMonitor: React.FC = () => {
  const [data, setData] = useState<DownDetectorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDownDetector()
      .then(setData)
      .catch(err => console.error('Error fetching downdetector data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="w-full h-full bg-black/30 backdrop-blur-lg border-white/20">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-white/60">Loading outage data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full h-full bg-black/30 backdrop-blur-lg border-white/20">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-white/60">No outage data available</p>
        </CardContent>
      </Card>
    );
  }


  const chartData = data.chart.data;
  const baselineData = data.chart.baseline;
  const maxY = Math.max(...chartData.map(d => d.y), ...baselineData.map(d => d.y));
  const currentReports = chartData[chartData.length - 1]?.y || 0;
  const avgReports = Math.round(chartData.reduce((sum, d) => sum + d.y, 0) / chartData.length);


  const getStatus = () => {
    if (currentReports > avgReports * 1.5) return { text: 'High Activity', color: 'text-red-400' };
    if (currentReports > avgReports * 1.2) return { text: 'Elevated', color: 'text-yellow-400' };
    return { text: 'Normal', color: 'text-green-400' };
  };

  const status = getStatus();


  const yAxisMax = Math.ceil(maxY * 1.1 / 10) * 10 || 100;
  const yAxisSteps = 4;
  const yAxisValues = Array.from({ length: yAxisSteps + 1 }, (_, i) =>
    Math.round((yAxisMax / yAxisSteps) * i)
  ).reverse();


  const getTimeLabel = (timeStr: string) => {
    try {

      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {

        const match = timeStr.match(/(\d+):00\s*(AM|PM)/);
        if (match) return `${match[1]}${match[2]}`;
        return timeStr;
      }


      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hours}:${minutes}`;
    } catch {
      return timeStr;
    }
  };


  const showXAxisLabel = (i: number, total: number) => {

    if (i === 0 || i === total - 1) return true;


    if (total <= 12) return i % 3 === 0;
    if (total <= 24) return i % 6 === 0;
    if (total <= 48) return i % 8 === 0;
    return i % 12 === 0;
  };

  return (
    <Card className="w-full h-full bg-black/30 backdrop-blur-lg border-white/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
            <CardTitle className="text-lg font-semibold tracking-tight text-white/95">
              DownDetector Monitor
            </CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-white/50 uppercase tracking-wider font-medium mb-0.5">Status</div>
              <div className={`text-sm font-semibold tracking-wide ${status.color}`}>{status.text}</div>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-right">
              <div className="text-xs text-white/50 uppercase tracking-wider font-medium mb-0.5">Current</div>
              <div className="text-sm font-semibold text-white/90">{currentReports} <span className="text-xs text-white/40">/ 15min</span></div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-5rem)] pb-4">
        <div className="w-full h-full flex gap-3">
          {}
          <div className="flex flex-col justify-between text-[11px] text-white/50 font-mono font-medium pt-2 pb-8">
            {yAxisValues.map((value, i) => (
              <div key={i} className="text-right pr-3 leading-none" style={{ minWidth: '40px' }}>
                {value}
              </div>
            ))}
          </div>

          {}
          <div className="flex-1 flex flex-col min-w-0">
            {}
            <div className="flex-1 relative border-l-2 border-b-2 border-white/20 rounded-bl-sm" style={{ minHeight: 0 }}>
              {}
              {yAxisValues.map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-white/8"
                  style={{
                    bottom: `${(i / yAxisSteps) * 100}%`,
                    borderStyle: i === 0 ? 'solid' : 'dashed'
                  }}
                />
              ))}

              {}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="rgb(96, 165, 250)" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="rgb(96, 165, 250)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {}
                <path
                  d={(() => {
                    if (chartData.length === 0) return '';
                    const points = chartData.map((point, i) => {
                      const x = chartData.length === 1 ? 50 : (i / (chartData.length - 1)) * 100;
                      const y = 100 - (Math.min(point.y, yAxisMax) / yAxisMax) * 100;
                      return `${x} ${y}`;
                    });
                    const firstX = chartData.length === 1 ? 50 : 0;
                    const lastX = chartData.length === 1 ? 50 : 100;
                    return `M ${firstX} 100 L ${points.join(' L ')} L ${lastX} 100 Z`;
                  })()}
                  fill="url(#chartGradient)"
                />

                {}
                <polyline
                  points={chartData.map((point, i) => {
                    const x = chartData.length === 1 ? 50 : (i / (chartData.length - 1)) * 100;
                    const y = 100 - (Math.min(point.y, yAxisMax) / yAxisMax) * 100;
                    return `${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                  style={{ filter: 'drop-shadow(0 0 3px rgba(59, 130, 246, 0.4))' }}
                />
              </svg>

              {}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <radialGradient id="pointGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgb(96, 165, 250)" stopOpacity="1" />
                    <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8" />
                  </radialGradient>
                  <radialGradient id="alertGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgb(248, 113, 113)" stopOpacity="1" />
                    <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0.8" />
                  </radialGradient>
                </defs>
                {chartData.map((point, i) => {
                  const xPercent = chartData.length === 1 ? 50 : (i / (chartData.length - 1)) * 100;
                  const yPercent = 100 - (Math.min(point.y, yAxisMax) / yAxisMax) * 100;
                  const baseline = baselineData[i];
                  const isAboveBaseline = baseline && point.y > baseline.y * 1.2;

                  return (
                    <circle
                      key={i}
                      cx={`${xPercent}%`}
                      cy={`${yPercent}%`}
                      r="2"
                      fill={isAboveBaseline ? 'url(#alertGradient)' : 'url(#pointGradient)'}
                      opacity="0.95"
                      style={{ filter: 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.3))' }}
                    />
                  );
                })}
              </svg>

              {}
              <div className="absolute inset-0 flex">
                {chartData.map((point, i) => (
                  <div key={i} className="flex-1 group relative">
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3
                                  opacity-0 group-hover:opacity-100 transition-all duration-200
                                  bg-slate-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2
                                  whitespace-nowrap z-30 pointer-events-none border border-white/20
                                  shadow-xl">
                      <div className="font-bold text-blue-300 text-sm mb-0.5">{point.y} <span className="text-white/60 font-normal text-xs">reports</span></div>
                      <div className="text-white/70 text-[10px] font-medium">{point.x}</div>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900/95" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {}
            <div className="flex justify-between pt-2 text-[10px] text-white/50 font-mono font-medium">
              {chartData.map((point, i) => (
                <div key={i} className="flex-1 text-center leading-none">
                  {showXAxisLabel(i, chartData.length) ? getTimeLabel(point.x) : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        {}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500/80 shadow-lg shadow-blue-500/30" />
              <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Normal Range</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-lg shadow-red-500/30" />
              <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Elevated</span>
            </div>
          </div>
          <div className="text-[10px] text-white/40 font-medium">
            Avg: <span className="text-white/60 font-semibold">{avgReports}</span> reports/15min
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OutageMonitor;
