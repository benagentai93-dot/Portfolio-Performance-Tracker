import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isError = type === 'error';

  return (
    <div className="fixed top-4 right-4 z-[70] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg shadow-slate-900/10 bg-white border border-slate-200 animate-fade-in">
      {isError ? (
        <XCircle className="w-4 h-4 text-rose-500" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      )}
      <span className="text-sm font-medium text-slate-700 pr-2">{message}</span>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-900 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
