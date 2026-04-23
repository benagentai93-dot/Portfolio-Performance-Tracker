import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-[70] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg transition-all animate-in slide-in-from-top-2 ${
        type === 'error'
          ? 'bg-red-50 text-red-700 border border-red-100'
          : 'bg-green-50 text-green-700 border border-green-100'
      }`}
    >
      {type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
