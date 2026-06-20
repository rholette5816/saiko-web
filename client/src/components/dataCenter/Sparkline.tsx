interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  fillOpacity?: number;
  className?: string;
}

function cleanValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function Sparkline({
  values,
  width = 60,
  height = 24,
  stroke = "#c08643",
  fill = "#c08643",
  fillOpacity = 0.12,
  className,
}: SparklineProps) {
  const safeValues = (values.length ? values : [0]).map(cleanValue);
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const span = max - min;
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? width / 2 : (index / (safeValues.length - 1)) * width;
    const y = span === 0 ? height / 2 : height - ((value - min) / span) * height;
    return { x, y };
  });
  const pointText = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const fillPoints = `0,${height} ${pointText} ${width},${height}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
    >
      <polygon points={fillPoints} fill={fill} opacity={fillOpacity} />
      <polyline points={pointText} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
