import { useEffect, useRef, useState } from 'react';
import { trend, type Entry } from '../model';

export default function TrendChart({ entries, days = 7 }: { entries: Entry[]; days?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(550);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.round(entry.contentRect.width))),
    );
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  const values = trend(entries, days);
  const right = width - 24;
  const x = (i: number) => 29 + i * ((right - 29) / (days - 1));
  const y = (value: number) => 154 - (value - 1) * 31;
  let path = '';
  values.forEach((v, i) => {
    if (v.value !== null)
      path += `${i === 0 || values[i - 1].value === null ? 'M' : 'L'}${x(i)},${y(v.value)} `;
  });
  const hasData = values.some((v) => v.value !== null);
  const tickStep = days === 7 ? 1 : width < 450 ? 7 : 5;
  return (
    <div className="trend-chart" ref={container}>
      <svg
        viewBox={`0 0 ${width} 200`}
        role="img"
        aria-label={`近${days}天情绪强度趋势，同日记录取平均，无记录日期留空`}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <g key={value}>
            <line
              x1="29"
              x2={right}
              y1={y(value)}
              y2={y(value)}
              stroke="#e9ede6"
              strokeDasharray="3 5"
            />
            <text x="6" y={y(value) + 4} fill="#7c8974" fontSize="11">
              {value}
            </text>
          </g>
        ))}
        <path
          d={path}
          stroke="#789775"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {values.map((v, i) => (
          <g key={v.date}>
            {v.value !== null && (
              <circle
                cx={x(i)}
                cy={y(v.value)}
                r={days === 7 ? 4.5 : 3.5}
                fill="#fff"
                stroke="#789775"
                strokeWidth="2"
              >
                <title>
                  {v.date}：{v.count}条记录，平均强度{v.value.toFixed(1)}
                </title>
              </circle>
            )}
            {((i % tickStep === 0 && (days === 7 || days - i > tickStep / 2)) ||
              i === days - 1) && (
              <text x={x(i)} y="184" textAnchor="middle" fill="#7c8974" fontSize="10">
                {v.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {!hasData && <span className="chart-empty">记录之后，你的情绪轨迹会在这里慢慢出现</span>}
      <p className="chart-note">
        <span className="legend-dot" /> 情绪强度 · 越高代表感受越强烈，与好坏无关
      </p>
      <details className="chart-data">
        <summary>查看图表数据</summary>
        <div>
          {values.map((v) => (
            <span key={v.date}>
              {v.label}：{v.value === null ? '未记录' : `${v.value.toFixed(1)} / 5（${v.count}条）`}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
