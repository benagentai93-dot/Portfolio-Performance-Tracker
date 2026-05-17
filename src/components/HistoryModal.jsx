import { useEffect, useState } from 'react';
import { History, X, Sparkles, Loader2, StickyNote, Edit, Trash2 } from 'lucide-react';
import { apiKey } from '../lib/gemini.js';

export default function HistoryModal({ isOpen, onClose, history, onAdd, onUpdate, onDelete }) {
  const [newDate, setNewDate] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setNewDate('');
      setNewValue('');
      setNewNote('');
      setEditingId(null);
    }
  }, [isOpen]);

  const handleGenerateNote = async () => {
    if (!newDate) return;
    setIsGeneratingNote(true);
    try {
      const prompt = `Find the single most important US stock market news or economic event that happened on ${newDate}. Summarize it in Traditional Chinese in less than 15 characters. Example: "Fed升息3碼" or "Nvidia財報超預期".`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
        }
      );
      const data = await response.json();
      const note = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (note) setNewNote(note.trim());
    } catch (e) {
      console.error('Note gen error', e);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newDate || !newValue) return;

    const data = {
      date: newDate,
      value: parseFloat(newValue),
      note: newNote,
    };

    if (editingId) {
      onUpdate(editingId, data);
    } else {
      onAdd(data);
    }

    setNewDate('');
    setNewValue('');
    setNewNote('');
    setEditingId(null);
  };

  const handleEditClick = (item) => {
    setNewDate(item.date);
    setNewValue(item.value);
    setNewNote(item.note || '');
    setEditingId(item.id);
  };

  const handleCancelEdit = () => {
    setNewDate('');
    setNewValue('');
    setNewNote('');
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 max-w-md w-full flex flex-col max-h-[85vh] animate-fade-in">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              歷史資產市值
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">紀錄過去時間點的總資產</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5"
          >
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                required
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 bg-white tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <input
                type="number"
                required
                placeholder="總市值 (USD)"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-36 bg-white tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mb-3 relative">
              <input
                type="text"
                placeholder="備註 (例:領獎金)"
                className="border border-slate-200 rounded-lg pl-3 pr-20 py-2 text-sm flex-1 bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button
                type="button"
                onClick={handleGenerateNote}
                disabled={!newDate || isGeneratingNote}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-2 flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-medium transition-colors disabled:opacity-40"
                title="AI 自動產生當日市場備註"
              >
                {isGeneratingNote ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {isGeneratingNote ? '' : 'AI 備註'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                {editingId ? '更新紀錄' : '新增紀錄'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
              )}
            </div>
          </form>

          <div className="space-y-1.5">
            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                尚無歷史紀錄
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={`flex justify-between items-center px-3 py-2.5 rounded-lg transition-all group border ${
                    editingId === item.id
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium text-slate-600 text-sm tabular-nums">
                        {item.date}
                      </span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="font-semibold text-slate-900 text-sm tabular-nums">
                        ${item.value.toLocaleString()}
                      </span>
                    </div>
                    {item.note && (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <StickyNote className="w-2.5 h-2.5 text-slate-400" /> {item.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                      title="編輯"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="刪除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
