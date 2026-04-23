import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Bot, User, Send } from 'lucide-react';
import { apiKey } from '../lib/gemini.js';

export default function AiAnalysisModal({ isOpen, onClose, stats, depositsCount }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      if (messages.length === 0) {
        handleSendMessage('請根據我的數據，為我做一份簡短的投資績效診斷與建議。', true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, messages]);

  const handleSendMessage = async (text, isInitial = false) => {
    if (!text.trim() && !isInitial) return;

    const currentStats = statsRef.current;

    const newUserMsg = { role: 'user', text };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    const promptData = {
      totalInvestedUSD: currentStats.totalInvestedUSD,
      totalInvestedTWD: currentStats.totalInvestedTWD,
      currentValueUSD: currentStats.userValueUSD,
      currentValueTWD: currentStats.userValueTWD,
      userROI_USD: currentStats.userRoiUSD.toFixed(2),
      userROI_TWD: currentStats.userRoiTWD.toFixed(2),
      depositsCount,
      benchmarks: {
        QQQ:
          currentStats.benchmarkReturns.qqq && currentStats.totalInvestedUSD
            ? (
                (currentStats.benchmarkReturns.qqq /
                  parseFloat(currentStats.totalInvestedUSD.replace(/,/g, ''))) *
                100
              ).toFixed(2)
            : 0,
        VTI:
          currentStats.benchmarkReturns.vti && currentStats.totalInvestedUSD
            ? (
                (currentStats.benchmarkReturns.vti /
                  parseFloat(currentStats.totalInvestedUSD.replace(/,/g, ''))) *
                100
              ).toFixed(2)
            : 0,
        VT:
          currentStats.benchmarkReturns.vt && currentStats.totalInvestedUSD
            ? (
                (currentStats.benchmarkReturns.vt /
                  parseFloat(currentStats.totalInvestedUSD.replace(/,/g, ''))) *
                100
              ).toFixed(2)
            : 0,
      },
      freedom: currentStats.freedomProgress,
    };

    const systemPrompt = `
      你是一位專業、有同理心的投資導師。
      你的任務是根據使用者的投資組合數據回答問題或進行分析。

      【使用者目前的投資組合數據】
      - 總投入本金：$${promptData.totalInvestedUSD} USD (約 NT$${promptData.totalInvestedTWD})
      - 目前資產總值：$${promptData.currentValueUSD} USD (約 NT$${promptData.currentValueTWD})
      - 總報酬率 (USD)：${promptData.userROI_USD}%
      - 總報酬率 (TWD)：${promptData.userROI_TWD}% (含匯差)
      - 入金筆數：${promptData.depositsCount} 筆
      - 財富自由進度：${promptData.freedom.progressPercent.toFixed(1)}% (目標: $${promptData.freedom.targetUSD.toLocaleString()})

      【市場基準 (同期 All-in 報酬率)】
      - QQQ: ${promptData.benchmarks.QQQ}%
      - VTI: ${promptData.benchmarks.VTI}%
      - VT: ${promptData.benchmarks.VT}%

      【回答原則】
      1. 請使用繁體中文。
      2. 根據數據說實話，但保持鼓勵態度。
      3. 如果使用者的績效不如大盤，請分析可能原因（如：擇時進出、選股問題、還是單純運氣不好）。
      4. 如果提到匯率，請說明匯率變動對他目前資產是正面還是負面影響。
      5. 回答請簡潔有力，不要長篇大論，除非使用者要求詳細解釋。
    `;

    const historyForApi = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    historyForApi.push({ role: 'user', parts: [{ text }] });

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: historyForApi,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ google_search: {} }],
          }),
        }
      );

      if (!response.ok) throw new Error('AI 服務連線失敗');

      const data = await response.json();
      const replyText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '抱歉，我現在無法回答。';

      setMessages((prev) => [...prev, { role: 'model', text: replyText }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'model', text: `發生錯誤: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col h-[85vh]">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">AI 智能投資顧問</h2>
              <p className="text-xs text-purple-200 opacity-90 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Online | Powered by Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
              <Bot className="w-12 h-12 opacity-20" />
              <p className="text-sm">正在準備您的投資分析報告...</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] gap-2 ${
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-indigo-100' : 'bg-purple-100'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Bot className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[85%] gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入問題，例如：我該如何改進？"
              disabled={isLoading}
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-full focus:ring-purple-500 focus:border-purple-500 block w-full p-3 pl-4 outline-none disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {['分析我的資產配置', '最近表現如何？', '匯率影響大嗎？', '距離財富自由還要多久？'].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-3 py-1 bg-gray-50 hover:bg-purple-50 text-xs text-gray-600 hover:text-purple-700 border border-gray-200 hover:border-purple-200 rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
