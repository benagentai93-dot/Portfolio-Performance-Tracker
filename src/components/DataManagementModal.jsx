import { useRef, useState } from 'react';
import { Database, X, UploadCloud, Archive, FileUp, FileDown, Sparkles, Loader2 } from 'lucide-react';
import Toast from './Toast.jsx';
import { exportToCSV, exportToJSON, parseStockCSV } from '../lib/helpers.js';

export default function DataManagementModal({
  isOpen,
  onClose,
  deposits,
  history,
  settings,
  onRestore,
  onUploadMarketData,
  onBackfillTicker,
  onBackfillAll,
  isBackfillingTicker,
}) {
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const [uploadTicker, setUploadTicker] = useState('');
  const [notification, setNotification] = useState(null);

  if (!isOpen) return null;

  const handleExportDeposits = () => {
    const headers = [
      '日期',
      '投入金額 (USD)',
      '匯率',
      '投入金額 (TWD)',
      'QQQ 當時價',
      'VTI 當時價',
      'VT 當時價',
      'QLD 當時價',
      'SOXX 當時價',
    ];
    const data = deposits.map((d) => [
      d.date,
      d.amount,
      d.exchangeRate || '-',
      d.exchangeRate ? Math.round(Math.abs(d.amount) * d.exchangeRate) : '-',
      d.qqqPrice,
      d.vtiPrice,
      d.vtPrice,
      d.qldPrice || '-',
      d.soxxPrice || '-',
    ]);
    exportToCSV(data, 'investment_deposits.csv', headers);
  };

  const handleExportHistory = () => {
    const headers = ['日期', '資產總市值 (USD)', '備註'];
    const data = history.map((h) => [h.date, h.value, h.note || '']);
    exportToCSV(data, 'portfolio_history.csv', headers);
  };

  const handleBackupJSON = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      appVersion: '1.3',
      deposits,
      portfolioHistory: history,
      settings,
    };
    exportToJSON(backupData, 'investment_tracker_backup.json');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onRestore(data);
      } catch (error) {
        setNotification({ type: 'error', message: '檔案格式錯誤，請上傳正確的 JSON 備份檔。' });
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvUpload = (ticker) => {
    setUploadTicker(ticker);
    csvInputRef.current?.click();
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTicker) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const result = parseStockCSV(text);
      if (result.error) {
        setNotification({ type: 'error', message: result.error });
      } else if (result.data) {
        onUploadMarketData(uploadTicker, result.data);
        setNotification({ type: 'success', message: `${uploadTicker} 上傳成功！` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 max-w-sm w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              資料管理
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">匯入、備份、匯出</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">
              上傳歷史股價 CSV
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => handleCsvUpload(ticker)}
                  className="flex flex-col items-center justify-center py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-200 gap-1"
                >
                  <UploadCloud className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-medium tracking-wide">{ticker}</span>
                </button>
              ))}
            </div>
            <input
              type="file"
              ref={csvInputRef}
              onChange={handleCsvFileChange}
              accept=".csv"
              className="hidden"
            />
            <p className="text-[10px] text-slate-400 mt-2">
              支援 Yahoo Finance / Investing.com / 自訂格式
            </p>
          </div>

          {onBackfillTicker && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">
                自動補齊歷史價
              </h3>
              {onBackfillAll && (
                <button
                  type="button"
                  onClick={onBackfillAll}
                  disabled={!!isBackfillingTicker}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isBackfillingTicker ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="text-xs font-medium tracking-wide">
                    {isBackfillingTicker ? `補齊 ${isBackfillingTicker} 中...` : '一鍵全部補齊'}
                  </span>
                </button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].map((ticker) => {
                  const busy = isBackfillingTicker === ticker;
                  const anyBusy = !!isBackfillingTicker;
                  return (
                    <button
                      key={ticker}
                      onClick={() => onBackfillTicker(ticker)}
                      disabled={anyBusy}
                      className="flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded-lg transition-colors border border-slate-200"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="text-[11px] font-medium tracking-wide">{ticker}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                從 Stooq 抓歷史日線並回填舊交易紀錄缺的當時價,新使用者首次載入時會自動執行
              </p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">
              備份與還原
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleBackupJSON}
                className="flex items-center justify-center py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-200 gap-2"
              >
                <Archive className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium">下載備份</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-200 gap-2"
              >
                <FileUp className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium">還原資料</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">
              匯出 CSV
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleExportDeposits}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-200"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <FileDown className="w-3.5 h-3.5 text-slate-400" /> 匯出交易紀錄
                </span>
                <span className="text-[10px] tabular-nums bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                  {deposits.length}
                </span>
              </button>
              <button
                onClick={handleExportHistory}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-200"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <FileDown className="w-3.5 h-3.5 text-slate-400" /> 匯出歷史市值
                </span>
                <span className="text-[10px] tabular-nums bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                  {history.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
