import { StickyNote } from 'lucide-react';

export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const myValue = payload.find((p) => p.dataKey === 'MyValue')?.value;
  const principal = payload.find((p) => p.dataKey === 'principal')?.value;
  let pnl = null;
  if (typeof myValue === 'number' && typeof principal === 'number') {
    pnl = myValue - principal;
  }

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
      <p className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-100 pb-1">{label}</p>

      {pnl !== null && (
        <div
          className={`flex items-center justify-between gap-4 text-sm mb-2 pb-2 border-b border-dashed border-gray-100 ${
            pnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">損益 (P&L)</span>
          </div>
          <span className="font-bold font-mono">
            {pnl > 0 ? '+' : ''}
            {pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {payload.map((entry, index) => {
        let name = entry.name;
        if (entry.dataKey === 'pnlArea') return null;

        if (name === 'MyValue') name = '我的實際資產';
        if (name === 'principal') name = '累積本金';
        if (name === 'QQQ') name = 'QQQ 市值';
        if (name === 'VTI') name = 'VTI 市值';
        if (name === 'VT') name = 'VT 市值';

        if (entry.value === null || entry.value === undefined) return null;

        return (
          <div key={index} className="flex items-center justify-between gap-4 text-xs mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></span>
              <span className="text-gray-600">{name}</span>
            </div>
            <span className="font-medium font-mono">
              $
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : entry.value}
            </span>
          </div>
        );
      })}
      {data.note && (
        <div className="mt-3 pt-2 border-t border-orange-100 bg-orange-50 -mx-3 -mb-3 p-3 rounded-b-lg">
          <div className="flex items-start gap-2 text-xs text-orange-800">
            <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="italic leading-relaxed">{data.note}</span>
          </div>
        </div>
      )}
    </div>
  );
}
