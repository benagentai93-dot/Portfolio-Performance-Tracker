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
    <div className="bg-white px-3.5 py-3 border border-slate-200 rounded-xl shadow-lg shadow-slate-900/5 z-50 min-w-[210px]">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2.5 tabular-nums">
        {label}
      </p>

      {pnl !== null && (
        <div
          className={`flex items-center justify-between gap-4 text-sm mb-2 pb-2 border-b border-dashed border-slate-100 ${
            pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          <span className="font-medium text-[11px] uppercase tracking-wider">損益 P&L</span>
          <span className="font-semibold tabular-nums">
            {pnl > 0 ? '+' : ''}
            {pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {payload.map((entry, index) => {
        let name = entry.name;
        if (entry.dataKey === 'pnlArea') return null;

        if (name === 'MyValue') name = '我的資產';
        if (name === 'principal') name = '累積本金';
        if (name === 'QQQ') name = 'QQQ';
        if (name === 'VTI') name = 'VTI';
        if (name === 'VT') name = 'VT';
        if (name === 'QLD') name = 'QLD';
        if (name === 'SOXX') name = 'SOXX';

        if (entry.value === null || entry.value === undefined) return null;

        return (
          <div key={index} className="flex items-center justify-between gap-4 text-xs mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></span>
              <span className="text-slate-600 font-medium">{name}</span>
            </div>
            <span className="font-medium tabular-nums text-slate-900">
              $
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                : entry.value}
            </span>
          </div>
        );
      })}
      {data.note && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 -mx-3.5 -mb-3 px-3.5 py-2.5 rounded-b-xl">
            <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
            <span className="italic leading-relaxed">{data.note}</span>
          </div>
        </div>
      )}
    </div>
  );
}
