import { useRef, useState } from 'react';
import { Database, X, UploadCloud, Archive, FileUp, FileDown } from 'lucide-react';
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
    ];
    const data = deposits.map((d) => [
      d.date,
      d.amount,
      d.exchangeRate || '-',
      d.exchangeRate ? Math.round(Math.abs(d.amount) * d.exchangeRate) : '-',
      d.qqqPrice,
      d.vtiPrice,
      d.vtPrice,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-600" />
            資料管理
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              📈 上傳歷史股價 (CSV) 以優化圖表
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {['QQQ', 'VTI', 'VT'].map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => handleCsvUpload(ticker)}
                  className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors border border-gray-200 gap-1"
                >
                  <UploadCloud className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-bold">{ticker}</span>
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
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              支援 Yahoo Finance (Adj Close)、Investing.com 或自訂格式
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              完整備份與還原
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleBackupJSON}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-100 gap-2"
              >
                <Archive className="w-6 h-6" />
                <span className="text-sm font-bold">下載備份 (JSON)</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors border border-purple-100 gap-2"
              >
                <FileUp className="w-6 h-6" />
                <span className="text-sm font-bold">還原資料</span>
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

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              匯出報表 (Excel/CSV)
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleExportDeposits}
                className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors border border-green-100"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileDown className="w-4 h-4" /> 匯出交易紀錄
                </span>
                <span className="text-xs bg-green-200 px-2 py-0.5 rounded-full">
                  {deposits.length} 筆
                </span>
              </button>
              <button
                onClick={handleExportHistory}
                className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors border border-orange-100"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileDown className="w-4 h-4" /> 匯出歷史市值紀錄
                </span>
                <span className="text-xs bg-orange-200 px-2 py-0.5 rounded-full">
                  {history.length} 筆
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
