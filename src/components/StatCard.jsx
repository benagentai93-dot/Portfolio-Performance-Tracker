export default function StatCard({
  title,
  valueUSD,
  valueTWD,
  subtext,
  highlight = false,
  colorClass = 'text-gray-900',
}) {
  return (
    <div
      className={`bg-white p-4 rounded-xl shadow-sm border ${
        highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
      }`}
    >
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className="space-y-1">
        <div className={`text-2xl font-bold ${colorClass} flex items-baseline gap-1`}>
          <span className="text-base opacity-60">$</span>
          {valueUSD}
          <span className="text-xs font-normal text-gray-400 ml-1">USD</span>
        </div>
        <div className="text-lg font-semibold text-gray-600 flex items-baseline gap-1">
          <span className="text-xs opacity-60">NT$</span>
          {valueTWD}
          <span className="text-xs font-normal text-gray-400 ml-1">TWD</span>
        </div>
      </div>
      {subtext && (
        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">{subtext}</div>
      )}
    </div>
  );
}
