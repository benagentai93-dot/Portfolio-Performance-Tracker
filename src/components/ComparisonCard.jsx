export default function ComparisonCard({
  symbol,
  userTotalReturn,
  benchmarkTotalReturn,
  benchmarkValue,
  color,
}) {
  const diff = userTotalReturn - benchmarkTotalReturn;
  const isWinning = diff >= 0;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${color}`}></span>
            <h3 className="font-semibold text-sm text-slate-900 tracking-tight">
              {symbol}
              <span className="ml-1 text-slate-400 font-normal">All-in</span>
            </h3>
          </div>
          <span className="text-[10px] font-medium tracking-wider uppercase text-slate-400">
            benchmark
          </span>
        </div>

        <div className="space-y-1 mb-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            理論市值
          </p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums tracking-tight">
            $
            {typeof benchmarkValue === 'number'
              ? benchmarkValue.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : '0'}
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-500 mb-1 font-medium">vs. 您的績效 (USD)</p>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-lg font-semibold tabular-nums tracking-tight ${
              isWinning ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {isWinning ? '+' : ''}
            {typeof diff === 'number'
              ? diff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : '0'}
          </span>
          <span
            className={`text-xs font-medium tabular-nums ${
              isWinning ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            ({userTotalReturn > 0 ? ((diff / userTotalReturn) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {isWinning ? `您贏過 ${symbol}` : `落後 ${symbol}`}
        </p>
      </div>
    </div>
  );
}
