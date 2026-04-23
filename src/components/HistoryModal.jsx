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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            歷史資產市值紀錄
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500 mb-4">
            請輸入過去每個月底（或特定時間點）您的總資產價值，備註可顯示於圖表上。
          </p>

          <form
            onSubmit={handleSubmit}
            className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6"
          >
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                required
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <input
                type="number"
                required
                placeholder="總市值 (USD)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 outline-none focus:ring-2 focus:ring-blue-500"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mb-3 relative">
              <input
                type="text"
                placeholder="備註 (例：領獎金)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button
                type="button"
                onClick={handleGenerateNote}
                disabled={!newDate || isGeneratingNote}
                className="absolute right-1 top-1 bottom-1 px-2 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded text-xs font-medium transition-colors disabled:opacity-50"
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
                className={`flex-1 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {editingId ? '更新紀錄' : '新增紀錄'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-300"
                >
                  取消
                </button>
              )}
            </div>
          </form>

          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                尚無歷史紀錄
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={`flex justify-between items-center p-3 rounded-lg transition-all group border ${
                    editingId === item.id
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                      : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-700 text-sm">{item.date}</span>
                      <span className="text-gray-300 text-xs">→</span>
                      <span className="font-bold text-gray-900 text-sm">
                        ${item.value.toLocaleString()}
                      </span>
                    </div>
                    {item.note && (
                      <span className="text-xs text-orange-600 flex items-center gap-1">
                        <StickyNote className="w-3 h-3" /> {item.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title="編輯"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
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
