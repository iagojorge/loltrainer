import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';

export const COLORS = {
  win: '#00D166', loss: '#FF5252', blue: '#2E94DE', red: '#D04040', gold: '#FFD700',
  grid: '#2a323d', axis: '#8b94a3',
};
export const PALETTE = ['#2E94DE', '#FFD700', '#00D166', '#FF5252', '#A78BFA', '#F59E0B', '#22D3EE', '#FB7185'];

const tooltipStyle = {
  contentStyle: { background: '#161b22', border: '1px solid #2a323d', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#cbd5e1' },
  itemStyle: { color: '#e5e7eb' },
};

function Frame({ height = 240, children }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

// Barras verticais simples (ex.: win rate por posição/patch)
export function VBar({ data, xKey, yKey, color = COLORS.blue, height = 240, domain, unit = '', colorByValue }) {
  return (
    <Frame height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis domain={domain} tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} unit={unit} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorByValue ? colorByValue(d[yKey]) : color} />
          ))}
          <LabelList dataKey={yKey} position="top" fill={COLORS.axis} fontSize={11} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

// Barras empilhadas (ex.: composição de dano físico/mágico/verdadeiro por jogador)
export function StackedBar({ data, xKey, series, height = 260, unit = '' }) {
  return (
    <Frame height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={{ stroke: COLORS.grid }} tickLine={false}
          interval={0} angle={-25} textAnchor="end" height={56} />
        <YAxis tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} unit={unit} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </Frame>
  );
}

// Barras horizontais (ranking)
export function HBar({ data, labelKey, valueKey, color = COLORS.gold, height = 240, unit = '' }) {
  return (
    <Frame height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} unit={unit} />
        <YAxis type="category" dataKey={labelKey} width={110} tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]}>
          <LabelList dataKey={valueKey} position="right" fill={COLORS.axis} fontSize={11} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

// Linha de tendência única
export function TrendLine({ data, xKey, yKey, color = COLORS.win, height = 240, domain, unit = '' }) {
  return (
    <Frame height={height}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={{ stroke: COLORS.grid }} tickLine={false} minTickGap={20} />
        <YAxis domain={domain} tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} unit={unit} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </Frame>
  );
}

// Múltiplas linhas (ex.: ouro azul vs vermelho, níveis por jogador)
export function MultiLine({ data, xKey, series, height = 260, unit = '' }) {
  return (
    <Frame height={height}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={{ stroke: COLORS.grid }} tickLine={false} unit={unit} />
        <YAxis tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </Frame>
  );
}

// Área dupla (ouro acumulado por time)
export function DualArea({ data, xKey, series, height = 260 }) {
  return (
    <Frame height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -4, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.5} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={{ stroke: COLORS.grid }} tickLine={false} unit="m" />
        <YAxis tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
        ))}
      </AreaChart>
    </Frame>
  );
}

// Donut / Pizza
export function Donut({ data, height = 240, inner = 55 }) {
  return (
    <Frame height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={inner} outerRadius={85} paddingAngle={2} stroke="none">
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </Frame>
  );
}

// Dispersão (cs/min x kda). labelKey opcional → escreve de quem é cada ponto.
export function ScatterPerf({ data, xKey, yKey, xLabel, yLabel, labelKey, color = COLORS.gold, height = 280 }) {
  const renderLabel = (props) => {
    const { x, y, index } = props;
    const name = data[index]?.[labelKey];
    if (!name) return null;
    return <text x={x} y={y - 8} fill={COLORS.axis} fontSize={10} textAnchor="middle">{name}</text>;
  };
  const dotTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={tooltipStyle.contentStyle}>
        {labelKey && <div style={{ color: '#e5e7eb', fontWeight: 600 }}>{d[labelKey]}</div>}
        <div style={{ color: '#cbd5e1' }}>{xLabel}: {d[xKey]?.toLocaleString?.('pt-BR') ?? d[xKey]}</div>
        <div style={{ color: '#cbd5e1' }}>{yLabel}: {d[yKey]?.toLocaleString?.('pt-BR') ?? d[yKey]}</div>
      </div>
    );
  };
  return (
    <Frame height={height}>
      <ScatterChart margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={COLORS.grid} />
        <XAxis type="number" dataKey={xKey} name={xLabel} tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={{ stroke: COLORS.grid }} tickLine={false}
          label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: COLORS.axis, fontSize: 11 }} />
        <YAxis type="number" dataKey={yKey} name={yLabel} tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: COLORS.axis, fontSize: 11 }} />
        <ZAxis range={[70, 70]} />
        <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} content={dotTooltip} />
        <Scatter data={data} fill={color}>
          {labelKey && <LabelList content={renderLabel} />}
        </Scatter>
      </ScatterChart>
    </Frame>
  );
}
