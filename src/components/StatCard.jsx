export default function StatCard({
  title,
  valueUSD,
  valueTWD,
  subtext,
  highlight = false,
  colorClass = 'text-slate-900',
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-5 transition-colors ${
        highlight ? 'border-slate-900/10 ring-1 ring-slate-900/5' : 'border-slate-200'
      }`}
    >
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-3">
        {title}
      </h3>
      <div className="space-y-1.5">
        <div className={`text-[26px] leading-none font-semibold tracking-tight tabular-nums ${colorClass} flex items-baseline gap-1`}>
          <span className="text-base font-normal text-slate-400">$</span>
          {valueUSD}
          <span className="text-[10px] font-medium text-slate-400 ml-1.5 tracking-wide">USD</span>
        </div>
        <div className="text-base font-medium text-slate-500 tabular-nums flex items-baseline gap-1">
          <span className="text-xs font-normal text-slate-400">NT$</span>
          {valueTWD}
          <span className="text-[10px] font-medium text-slate-400 ml-1.5 tracking-wide">TWD</span>
        </div>
      </div>
      {subtext && (
        <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{subtext}</div>
      )}
    </div>
  );
}
