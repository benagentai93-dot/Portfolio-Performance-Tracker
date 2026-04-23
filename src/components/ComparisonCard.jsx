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
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${color}`}></span>
            <h3 className="font-bold text-lg">{symbol} All-in 策略</h3>
          </div>
          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">基準</span>
        </div>

        <div className="space-y-1 mb-4">
          <p className="text-sm text-gray-500">當前理論市值</p>
          <p className="text-xl font-bold text-gray-800">
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

      <div
        className={`p-3 rounded-lg ${
          isWinning ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
        }`}
      >
        <p className="text-xs text-gray-600 mb-1">與您的績效對比 (USD)</p>
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-bold ${isWinning ? 'text-green-600' : 'text-red-600'}`}>
            {isWinning ? '+' : ''}
            {typeof diff === 'number'
              ? diff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : '0'}
          </span>
          <span className={`text-xs font-medium ${isWinning ? 'text-green-600' : 'text-red-600'}`}>
            ({userTotalReturn > 0 ? ((diff / userTotalReturn) * 100).toFixed(1) : 0}%)
          </span>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          {isWinning ? `您贏過 ${symbol}` : `落後 ${symbol}`}
        </p>
      </div>
    </div>
  );
}
