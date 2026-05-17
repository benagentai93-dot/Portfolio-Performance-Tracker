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
        QLD:
          currentStats.benchmarkReturns.qld && currentStats.totalInvestedUSD
            ? (
                (currentStats.benchmarkReturns.qld /
                  parseFloat(currentStats.totalInvestedUSD.replace(/,/g, ''))) *
                100
              ).toFixed(2)
            : 0,
        SOXX:
          currentStats.benchmarkReturns.soxx && currentStats.totalInvestedUSD
            ? (
                (currentStats.benchmarkReturns.soxx /
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
      - QLD (2x QQQ): ${promptData.benchmarks.QLD}%
      - SOXX (半導體): ${promptData.benchmarks.SOXX}%

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 max-w-lg w-full overflow-hidden flex flex-col h-[85vh]">
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white w-9 h-9 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                AI 投資顧問
              </h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Powered by Gemini</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 transition-colors p-1.5 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <Bot className="w-10 h-10 opacity-30" />
              <p className="text-xs">正在準備投資分析報告...</p>
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
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                </div>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-sm'
                      : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'
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
                <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-200 flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
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
              placeholder="輸入問題..."
              disabled={isLoading}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-full focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 block w-full px-4 py-2.5 outline-none disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-slate-900 hover:bg-slate-800 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {['分析我的資產配置', '最近表現如何', '匯率影響大嗎', '距離財富自由還要多久'].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-3 py-1.5 bg-white hover:bg-slate-50 text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 rounded-full transition-colors"
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
