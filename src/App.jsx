import { useEffect, useMemo, useRef, useState } from 'react';
import {
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  PlusCircle,
  Trash2,
  Edit,
  TrendingUp,
  Calendar,
  Search,
  ExternalLink,
  RefreshCw,
  Target,
  Sparkles,
  X,
  BarChart3,
  Database,
  History,
  Loader2,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  Flag,
  ImagePlus,
  Calculator,
  AlertCircle,
  LogIn,
  LogOut,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { auth, db, appId, googleProvider, initialAuthToken } from './lib/firebase.js';
import { extractJSON, xirr } from './lib/helpers.js';
import { apiKey } from './lib/gemini.js';

import Toast from './components/Toast.jsx';
import StatCard from './components/StatCard.jsx';
import ComparisonCard from './components/ComparisonCard.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import CustomTooltip from './components/CustomTooltip.jsx';
import AiAnalysisModal from './components/AiAnalysisModal.jsx';
import HistoryModal from './components/HistoryModal.jsx';
import DataManagementModal from './components/DataManagementModal.jsx';

export default function InvestmentTracker() {
  const [user, setUser] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [marketData, setMarketData] = useState({ QQQ: [], VTI: [], VT: [] });
  const [marketSettings, setMarketSettings] = useState({
    currentPortfolioValue: 0,
    currentExchangeRate: 32.5,
    currentQQQ: 0,
    currentVTI: 0,
    currentVT: 0,
    targetAmountUSD: 1000000,
    lastUpdated: null,
  });

  const [timeRange, setTimeRange] = useState('Max');
  const [showPnL, setShowPnL] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDepositId, setEditingDepositId] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const [showProjection, setShowProjection] = useState(false);
  const [projAnnualDeposit, setProjAnnualDeposit] = useState('12000');
  const [projAnnualReturn, setProjAnnualReturn] = useState('7');

  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const fileInputRef = useRef(null);

  const [deleteId, setDeleteId] = useState(null);
  const [restoreData, setRestoreData] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const [visibleBenchmarks, setVisibleBenchmarks] = useState({
    QQQ: true,
    VTI: false,
    VT: false,
  });

  const [newDeposit, setNewDeposit] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'deposit',
    amount: '',
    exchangeRate: '',
    qqqPrice: '',
    vtiPrice: '',
    vtPrice: '',
  });

  const [tempSettings, setTempSettings] = useState({ ...marketSettings });

  useEffect(() => {
    const initAuth = async () => {
      if (initialAuthToken) {
        await signInWithCustomToken(auth, initialAuthToken);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth().catch((err) => console.error('Auth error', err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      if (user?.isAnonymous) {
        await linkWithPopup(user, googleProvider);
        setNotification({ type: 'success', message: '已連結 Google 帳號，資料已保留' });
      } else {
        await signInWithPopup(auth, googleProvider);
        setNotification({ type: 'success', message: '已登入 Google 帳號' });
      }
    } catch (err) {
      if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/email-already-in-use') {
        try {
          await signOut(auth);
          await signInWithPopup(auth, googleProvider);
          setNotification({
            type: 'info',
            message: '已切換到現有 Google 帳號（此瀏覽器原本的匿名資料未合併）',
          });
        } catch (fallbackErr) {
          console.error('Google sign-in fallback error', fallbackErr);
          setNotification({ type: 'error', message: '登入失敗，請再試一次' });
        }
      } else if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('Google sign-in error', err);
        setNotification({ type: 'error', message: '登入失敗：' + (err?.message || err?.code || '未知錯誤') });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      await signInAnonymously(auth);
      setNotification({ type: 'info', message: '已登出，切換為匿名使用' });
    } catch (err) {
      console.error('Sign out error', err);
      setNotification({ type: 'error', message: '登出失敗' });
    }
  };

  useEffect(() => {
    if (!user) return;
    const depositsQuery = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'deposits')
    );
    const historyQuery = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'portfolioHistory')
    );
    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'marketData');

    const unsubDeposits = onSnapshot(
      depositsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDeposits(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      },
      (error) => console.error('Error fetching deposits:', error)
    );

    const unsubHistory = onSnapshot(
      historyQuery,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPortfolioHistory(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setLoading(false);
      },
      (error) => console.error('Error fetching history:', error)
    );

    const unsubSettings = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMarketSettings(data);
          setTempSettings(data);
        }
      },
      (error) => console.error('Error fetching settings:', error)
    );

    const fetchMarketData = async () => {
      const tickers = ['QQQ', 'VTI', 'VT'];
      const newData = {};
      for (const ticker of tickers) {
        try {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'marketData', ticker);
          const docSnap = await getDoc(docRef);
          newData[ticker] = docSnap.exists() ? docSnap.data().prices || [] : [];
        } catch (e) {
          console.error(`Error loading market data for ${ticker}`, e);
        }
      }
      setMarketData(newData);
    };
    fetchMarketData();

    return () => {
      unsubDeposits();
      unsubHistory();
      unsubSettings();
    };
  }, [user]);

  const handleScanReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanningImage(true);
    setNotification({ type: 'success', message: '正在請 AI 判讀截圖內容...' });

    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const prompt = `
        You are a helpful assistant for a Taiwanese investor.
        Please look at the uploaded image of a brokerage statement or transaction receipt.
        Extract the following information:
        1. Transaction Date (Format as YYYY-MM-DD)
        2. Deposit/Withdrawal Amount in USD (Number only, absolute value)
        3. Determine if it is a deposit or withdrawal. (Use "deposit" or "withdrawal")
        4. (Optional) If you see USD/TWD exchange rate used for this transaction, extract it. Otherwise return null.

        Return ONLY a valid JSON object. No other text or markdown formatting.
        Example JSON:
        {
          "date": "2023-10-25",
          "amount": 5000.00,
          "type": "deposit",
          "exchangeRate": 32.15
        }
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: file.type, data: base64Data } },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) throw new Error('AI 圖像解析連線失敗');

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const extractedData = extractJSON(text);

      if (extractedData) {
        setNewDeposit((prev) => ({
          ...prev,
          date: extractedData.date || prev.date,
          type: extractedData.type === 'withdrawal' ? 'withdrawal' : 'deposit',
          amount: extractedData.amount || prev.amount,
          exchangeRate: extractedData.exchangeRate || prev.exchangeRate,
        }));
        setNotification({
          type: 'success',
          message: '🎉 掃描成功！已為您自動填入資料，建議點擊「智慧填入」補齊股價。',
        });
      } else {
        setNotification({ type: 'error', message: '無法從圖片中辨識所需資訊，請手動輸入。' });
      }
    } catch (error) {
      console.error('Scan error:', error);
      setNotification({ type: 'error', message: 'AI 解析過程中發生錯誤。' });
    } finally {
      setIsScanningImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAutoFillPrices = async () => {
    if (!newDeposit.date) {
      setNotification({ type: 'error', message: '請先選擇日期' });
      return;
    }

    setIsFetchingPrices(true);

    const localPrices = { qqq: null, vti: null, vt: null };

    const findLocalPrice = (ticker) => {
      const data = marketData[ticker];
      if (!data || data.length === 0) return null;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].date <= newDeposit.date) {
          return data[i].close;
        }
      }
      return null;
    };

    localPrices.qqq = findLocalPrice('QQQ');
    localPrices.vti = findLocalPrice('VTI');
    localPrices.vt = findLocalPrice('VT');

    setNewDeposit((prev) => ({
      ...prev,
      qqqPrice: localPrices.qqq || prev.qqqPrice,
      vtiPrice: localPrices.vti || prev.vtiPrice,
      vtPrice: localPrices.vt || prev.vtPrice,
    }));

    const missingStocks = !localPrices.qqq || !localPrices.vti || !localPrices.vt;
    const missingRate = !newDeposit.exchangeRate;

    if (missingStocks || missingRate) {
      try {
        const prompt = `
            I have these values from local CSV:
            QQQ: ${localPrices.qqq || 'MISSING'}
            VTI: ${localPrices.vti || 'MISSING'}
            VT: ${localPrices.vt || 'MISSING'}
            Rate: ${newDeposit.exchangeRate || 'MISSING'}

            Please find the MISSING historical prices on ${newDeposit.date} from public financial data.
            For Exchange Rate (USD to TWD), ALWAYS find it.

            Rules:
            - If ${newDeposit.date} is a weekend/holiday, use the previous trading day's close.
            - Output ONLY valid JSON. No markdown.

            JSON Format:
            {
              "qqq": number (only if missing),
              "vti": number (only if missing),
              "vt": number (only if missing),
              "rate": number
            }
          `;

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

        if (!response.ok) throw new Error('AI Service Error');

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const aiPrices = extractJSON(text);

        if (aiPrices) {
          setNewDeposit((prev) => ({
            ...prev,
            qqqPrice: aiPrices.qqq || prev.qqqPrice,
            vtiPrice: aiPrices.vti || prev.vtiPrice,
            vtPrice: aiPrices.vt || prev.vtPrice,
            exchangeRate: aiPrices.rate || prev.exchangeRate,
          }));
        } else {
          setNotification({ type: 'error', message: 'AI 回應格式錯誤' });
        }
      } catch (err) {
        console.error('AI fetch error:', err);
        if (!missingStocks) {
          setNotification({
            type: 'error',
            message: '已從 CSV 載入股價，但 AI 匯率抓取失敗。',
          });
        } else {
          setNotification({ type: 'error', message: '自動抓取部分失敗。' });
        }
      }
    }

    setIsFetchingPrices(false);
  };

  const stats = useMemo(() => {
    let totalInvestedUSD = 0;
    let totalInvestedTWD = 0;
    let totalQQQShares = 0;
    let totalVTIShares = 0;
    let totalVTShares = 0;
    let activeDepositsCount = 0;

    deposits.forEach((d) => {
      const amt = parseFloat(d.amount) || 0;
      const rate = parseFloat(d.exchangeRate) || 0;

      if (amt !== 0) {
        activeDepositsCount++;
        totalInvestedUSD += amt;
        const effectiveRate = rate > 0 ? rate : parseFloat(marketSettings.currentExchangeRate) || 30;
        totalInvestedTWD += amt * effectiveRate;
      }

      if (d.qqqPrice > 0) totalQQQShares += amt / parseFloat(d.qqqPrice);
      if (d.vtiPrice > 0) totalVTIShares += amt / parseFloat(d.vtiPrice);
      if (d.vtPrice > 0) totalVTShares += amt / parseFloat(d.vtPrice);
    });

    const currentQQQValue = totalQQQShares * (marketSettings.currentQQQ || 0);
    const currentVTIValue = totalVTIShares * (marketSettings.currentVTI || 0);
    const currentVTValue = totalVTShares * (marketSettings.currentVT || 0);

    const userValueUSD = parseFloat(marketSettings.currentPortfolioValue) || 0;
    const currentRate = parseFloat(marketSettings.currentExchangeRate) || 30;
    const userValueTWD = userValueUSD * currentRate;

    const userReturnUSD = userValueUSD - totalInvestedUSD;
    const userRoiUSD = totalInvestedUSD > 0 ? (userReturnUSD / totalInvestedUSD) * 100 : 0;

    const userReturnTWD = userValueTWD - totalInvestedTWD;
    const userRoiTWD = totalInvestedTWD > 0 ? (userReturnTWD / totalInvestedTWD) * 100 : 0;

    const targetUSD = parseFloat(marketSettings.targetAmountUSD) || 1000000;
    const targetTWD = targetUSD * currentRate;
    const progressPercent = Math.min(100, Math.max(0, (userValueUSD / targetUSD) * 100));
    const remainingUSD = Math.max(0, targetUSD - userValueUSD);

    const cashflows = [];
    deposits.forEach((d) => {
      const amt = parseFloat(d.amount) || 0;
      if (amt !== 0 && d.date) {
        const dt = new Date(d.date);
        if (!Number.isNaN(dt.getTime())) cashflows.push({ date: dt, amount: -amt });
      }
    });
    cashflows.sort((a, b) => a.date - b.date);
    if (userValueUSD > 0 && cashflows.length > 0) {
      cashflows.push({ date: new Date(), amount: userValueUSD });
    }
    const annualizedRate = cashflows.length >= 2 ? xirr(cashflows) : null;
    const annualizedPct = annualizedRate != null ? annualizedRate * 100 : null;

    let timeHeld = null;
    if (cashflows.length >= 2) {
      const totalDays =
        (cashflows[cashflows.length - 1].date - cashflows[0].date) / 86400000;
      const months = Math.round(totalDays / 30);
      if (months >= 12) {
        const y = Math.floor(months / 12);
        const m = months % 12;
        timeHeld = m > 0 ? `${y} 年 ${m} 個月` : `${y} 年`;
      } else if (months >= 1) {
        timeHeld = `${months} 個月`;
      } else {
        timeHeld = '不到 1 個月';
      }
    }

    return {
      totalInvestedUSD: totalInvestedUSD.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      totalInvestedTWD: totalInvestedTWD.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      userValueUSD: userValueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      userValueTWD: userValueTWD.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      userRoiUSD,
      userRoiTWD,
      userReturnUSD,
      annualizedPct,
      timeHeld,
      currentQQQValue,
      currentVTIValue,
      currentVTValue,
      activeDepositsCount,
      benchmarkReturns: {
        qqq: currentQQQValue - totalInvestedUSD,
        vti: currentVTIValue - totalInvestedUSD,
        vt: currentVTValue - totalInvestedUSD,
      },
      freedomProgress: {
        targetUSD,
        targetTWD,
        progressPercent,
        remainingUSD,
        userValueUSDRaw: userValueUSD,
        currentRate,
      },
    };
  }, [deposits, marketSettings]);

  const projection = useMemo(() => {
    if (!stats) return { years: 0, possible: false };

    const pv = parseFloat(stats.freedomProgress.userValueUSDRaw) || 0;
    const fv = parseFloat(stats.freedomProgress.targetUSD) || 1000000;
    const pmt = parseFloat(String(projAnnualDeposit).replace(/,/g, '')) || 0;
    const r = (parseFloat(String(projAnnualReturn).replace(/,/g, '')) || 0) / 100;

    if (pv >= fv) return { years: 0, possible: true };
    if (pmt <= 0 && r <= 0) return { years: -1, possible: false };

    let years = 0;
    if (r === 0) {
      years = (fv - pv) / pmt;
    } else {
      const pmtFactor = (pmt * (1 + r)) / r;
      const numerator = fv + pmtFactor;
      const denominator = pv + pmtFactor;

      if (denominator <= 0 || numerator / denominator <= 0) {
        return { years: -1, possible: false };
      }
      years = Math.log(numerator / denominator) / Math.log(1 + r);
    }

    return { years: Math.max(0, years), possible: true };
  }, [stats, projAnnualDeposit, projAnnualReturn]);

  const chartData = useMemo(() => {
    if (deposits.length === 0) return [];

    const allDatesSet = new Set();

    deposits.forEach((d) => allDatesSet.add(d.date));
    portfolioHistory.forEach((h) => allDatesSet.add(h.date));
    ['QQQ', 'VTI', 'VT'].forEach((ticker) => {
      marketData[ticker]?.forEach((p) => allDatesSet.add(p.date));
    });
    if (marketSettings.lastUpdated) allDatesSet.add('現在');

    const sortedDates = Array.from(allDatesSet).sort((a, b) => {
      if (a === '現在') return 1;
      if (b === '現在') return -1;
      return new Date(a) - new Date(b);
    });

    const depositMap = new Map();
    deposits.forEach((d) => {
      if (!depositMap.has(d.date)) depositMap.set(d.date, []);
      depositMap.get(d.date).push(d);
    });

    const historyMap = new Map();
    portfolioHistory.forEach((h) => historyMap.set(h.date, h));

    const marketPriceMap = { QQQ: new Map(), VTI: new Map(), VT: new Map() };
    ['QQQ', 'VTI', 'VT'].forEach((ticker) => {
      marketData[ticker]?.forEach((p) => marketPriceMap[ticker].set(p.date, p.close));
    });

    let cumPrincipal = 0;
    let cumQQQShares = 0;
    let cumVTIShares = 0;
    let cumVTShares = 0;

    let lastPriceQQQ = null;
    let lastPriceVTI = null;
    let lastPriceVT = null;

    const dataPoints = [];

    sortedDates.forEach((date) => {
      const isNow = date === '現在';

      if (depositMap.has(date)) {
        depositMap.get(date).forEach((d) => {
          const amt = parseFloat(d.amount) || 0;
          cumPrincipal += amt;
          if (d.qqqPrice > 0) cumQQQShares += amt / parseFloat(d.qqqPrice);
          if (d.vtiPrice > 0) cumVTIShares += amt / parseFloat(d.vtiPrice);
          if (d.vtPrice > 0) cumVTShares += amt / parseFloat(d.vtPrice);
        });
      }

      let priceQQQ = null;
      let priceVTI = null;
      let priceVT = null;

      if (isNow) {
        priceQQQ = parseFloat(marketSettings.currentQQQ);
        priceVTI = parseFloat(marketSettings.currentVTI);
        priceVT = parseFloat(marketSettings.currentVT);
      } else {
        priceQQQ = marketPriceMap.QQQ.get(date);
        priceVTI = marketPriceMap.VTI.get(date);
        priceVT = marketPriceMap.VT.get(date);

        if (!priceQQQ && depositMap.has(date)) priceQQQ = parseFloat(depositMap.get(date)[0].qqqPrice);
        if (!priceVTI && depositMap.has(date)) priceVTI = parseFloat(depositMap.get(date)[0].vtiPrice);
        if (!priceVT && depositMap.has(date)) priceVT = parseFloat(depositMap.get(date)[0].vtPrice);

        if (priceQQQ) lastPriceQQQ = priceQQQ;
        if (priceVTI) lastPriceVTI = priceVTI;
        if (priceVT) lastPriceVT = priceVT;

        if (!priceQQQ && lastPriceQQQ) priceQQQ = lastPriceQQQ;
        if (!priceVTI && lastPriceVTI) priceVTI = lastPriceVTI;
        if (!priceVT && lastPriceVT) priceVT = lastPriceVT;
      }

      const point = {
        date,
        principal: cumPrincipal,
        QQQ: priceQQQ ? cumQQQShares * priceQQQ : null,
        VTI: priceVTI ? cumVTIShares * priceVTI : null,
        VT: priceVT ? cumVTShares * priceVT : null,
        MyValue: null,
        note: null,
      };

      if (isNow) {
        point.MyValue = parseFloat(marketSettings.currentPortfolioValue);
      } else if (historyMap.has(date)) {
        const h = historyMap.get(date);
        point.MyValue = parseFloat(h.value);
        point.note = h.note;
      }

      if (cumPrincipal > 0 || depositMap.has(date)) {
        dataPoints.push(point);
      }
    });

    return dataPoints;
  }, [deposits, portfolioHistory, marketSettings, marketData]);

  const filteredChartData = useMemo(() => {
    if (timeRange === 'Max') return chartData;

    const now = new Date();
    let cutoff = new Date(now);

    switch (timeRange) {
      case '5D':
        cutoff.setDate(now.getDate() - 5);
        break;
      case '1M':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case '6M':
        cutoff.setMonth(now.getMonth() - 6);
        break;
      case 'YTD':
        cutoff = new Date(now.getFullYear(), 0, 1);
        break;
      case '1Y':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      case '5Y':
        cutoff.setFullYear(now.getFullYear() - 5);
        break;
      default:
        cutoff = null;
    }

    if (!cutoff) return chartData;

    return chartData.filter((point) => {
      const date = point.date === '現在' ? now : new Date(point.date);
      return date >= cutoff;
    });
  }, [chartData, timeRange]);

  const openAddModal = () => {
    setEditingDepositId(null);
    setNewDeposit({
      date: new Date().toISOString().split('T')[0],
      type: 'deposit',
      amount: '',
      exchangeRate: '',
      qqqPrice: '',
      vtiPrice: '',
      vtPrice: '',
    });
    setShowAddModal(true);
  };

  const openEditModal = (deposit) => {
    setEditingDepositId(deposit.id);
    setNewDeposit({
      date: deposit.date,
      type: deposit.amount < 0 ? 'withdrawal' : 'deposit',
      amount: Math.abs(deposit.amount),
      exchangeRate: deposit.exchangeRate || '',
      qqqPrice: deposit.qqqPrice || '',
      vtiPrice: deposit.vtiPrice || '',
      vtPrice: deposit.vtPrice || '',
    });
    setShowAddModal(true);
  };

  const handleSaveDeposit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const rawAmount = parseFloat(newDeposit.amount) || 0;
    const finalAmount =
      newDeposit.type === 'withdrawal' ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    const depositData = {
      date: newDeposit.date,
      amount: finalAmount,
      exchangeRate: parseFloat(newDeposit.exchangeRate) || 0,
      qqqPrice: parseFloat(newDeposit.qqqPrice) || 0,
      vtiPrice: parseFloat(newDeposit.vtiPrice) || 0,
      vtPrice: parseFloat(newDeposit.vtPrice) || 0,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingDepositId) {
        await updateDoc(
          doc(db, 'artifacts', appId, 'users', user.uid, 'deposits', editingDepositId),
          depositData
        );
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'deposits'), {
          ...depositData,
          createdAt: new Date().toISOString(),
        });
      }
      setShowAddModal(false);
      setEditingDepositId(null);
    } catch (err) {
      console.error('Error saving deposit', err);
    }
  };

  const handleAddHistory = async (historyItem) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'portfolioHistory'), {
        date: historyItem.date,
        value: historyItem.value,
        note: historyItem.note,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error adding history', err);
    }
  };

  const handleUpdateHistory = async (id, data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'portfolioHistory', id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error updating history', err);
    }
  };

  const handleDeleteHistory = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'portfolioHistory', id));
    } catch (err) {
      console.error('Error deleting history', err);
    }
  };

  const handleUploadMarketData = async (ticker, data) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'marketData', ticker), {
        prices: data,
        updatedAt: new Date().toISOString(),
      });
      setMarketData((prev) => ({ ...prev, [ticker]: data }));
      setNotification({ type: 'success', message: `${ticker} 歷史股價上傳成功！` });
      setShowDataModal(false);
    } catch (error) {
      console.error('Error uploading market data:', error);
      setNotification({ type: 'error', message: '上傳失敗，請稍後再試。' });
    }
  };

  const executeRestoreData = async () => {
    if (!user || !restoreData) return;

    try {
      const batch = writeBatch(db);

      if (restoreData.settings) {
        const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'marketData');
        batch.set(settingsRef, restoreData.settings);
      }

      if (Array.isArray(restoreData.deposits)) {
        restoreData.deposits.forEach((dep) => {
          const ref = dep.id
            ? doc(db, 'artifacts', appId, 'users', user.uid, 'deposits', dep.id)
            : doc(collection(db, 'artifacts', appId, 'users', user.uid, 'deposits'));
          // eslint-disable-next-line no-unused-vars
          const { id, ...data } = dep;
          batch.set(ref, data);
        });
      }

      if (Array.isArray(restoreData.portfolioHistory)) {
        restoreData.portfolioHistory.forEach((hist) => {
          const ref = hist.id
            ? doc(db, 'artifacts', appId, 'users', user.uid, 'portfolioHistory', hist.id)
            : doc(collection(db, 'artifacts', appId, 'users', user.uid, 'portfolioHistory'));
          // eslint-disable-next-line no-unused-vars
          const { id, ...data } = hist;
          batch.set(ref, data);
        });
      }

      await batch.commit();
      setShowRestoreConfirm(false);
      setRestoreData(null);
      setShowDataModal(false);
      setNotification({ type: 'success', message: '資料還原成功！' });
    } catch (err) {
      console.error('Error restoring data', err);
      setNotification({ type: 'error', message: '還原失敗，請檢查檔案是否正確。' });
    }
  };

  const executeDeleteDeposit = async () => {
    if (!user || !deleteId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'deposits', deleteId));
      setDeleteId(null);
      setNotification({ type: 'success', message: '紀錄已刪除' });
    } catch (err) {
      console.error('Error deleting', err);
      setNotification({ type: 'error', message: '刪除失敗' });
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    if (!user) return;

    const newData = {
      ...tempSettings,
      currentPortfolioValue: parseFloat(tempSettings.currentPortfolioValue) || 0,
      currentExchangeRate: parseFloat(tempSettings.currentExchangeRate) || 0,
      targetAmountUSD: parseFloat(tempSettings.targetAmountUSD) || 0,
      currentQQQ: parseFloat(tempSettings.currentQQQ) || 0,
      currentVTI: parseFloat(tempSettings.currentVTI) || 0,
      currentVT: parseFloat(tempSettings.currentVT) || 0,
      lastUpdated: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'marketData'), newData);
      setShowSettingsModal(false);
      setNotification({ type: 'success', message: '現價與目標更新成功！' });
    } catch (err) {
      console.error('Error updating settings', err);
      setNotification({ type: 'error', message: '更新失敗，請稍後再試。' });
    }
  };

  const toggleBenchmark = (ticker) => {
    setVisibleBenchmarks((prev) => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  const openSearch = (ticker, date) => {
    const q = `${ticker} price history ${date}`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">載入數據中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-10">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap gap-y-2 gap-x-3 justify-between items-center">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">
              ETF All-in 績效對比
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-2 text-sm bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-3 py-2 rounded-lg transition-all shadow-sm hover:shadow-md animate-pulse-slow"
            >
              <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">AI 績效診斷</span>
            </button>
            <button
              onClick={() => {
                setTempSettings(marketSettings);
                setShowSettingsModal(true);
              }}
              className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">更新現價</span>
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
            >
              <History className="w-4 h-4" /> <span className="hidden sm:inline">紀錄歷史市值</span>
            </button>
            <button
              onClick={() => setShowDataModal(true)}
              className="flex items-center gap-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors border border-blue-100"
            >
              <Database className="w-4 h-4" /> <span className="hidden sm:inline">資料管理</span>
            </button>
            {user && !user.isAnonymous ? (
              <button
                onClick={handleSignOut}
                title={user.email || user.displayName || ''}
                className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {user.displayName || user.email || '登出'}
                </span>
              </button>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center gap-2 text-sm bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg transition-colors border border-gray-200"
              >
                <LogIn className="w-4 h-4" /> <span className="hidden sm:inline">登入 Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="總投入本金"
            valueUSD={`$${stats.totalInvestedUSD}`}
            valueTWD={`${stats.totalInvestedTWD}`}
            subtext={`${stats.activeDepositsCount} 筆交易紀錄`}
          />
          <StatCard
            title="目前投資總市值"
            valueUSD={`$${stats.userValueUSD}`}
            valueTWD={`${stats.userValueTWD}`}
            highlight={true}
            colorClass="text-blue-600"
            subtext={`匯率基準: 1 USD ≈ ${marketSettings.currentExchangeRate} TWD`}
          />
          <StatCard
            title="您的總投資報酬率"
            valueUSD={`${stats.userRoiUSD > 0 ? '+' : ''}${stats.userRoiUSD.toFixed(2)}%`}
            valueTWD={`${stats.userRoiTWD > 0 ? '+' : ''}${stats.userRoiTWD.toFixed(2)}%`}
            colorClass={stats.userRoiUSD >= 0 ? 'text-green-600' : 'text-red-600'}
            subtext={
              <>
                <div>損益: ${Math.round(stats.userReturnUSD).toLocaleString()}</div>
                {stats.annualizedPct != null && (
                  <div>
                    年化報酬率 (XIRR)：
                    <span
                      className={
                        stats.annualizedPct >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                      }
                    >
                      {stats.annualizedPct >= 0 ? '+' : ''}
                      {stats.annualizedPct.toFixed(2)}%
                    </span>
                    {stats.timeHeld && <span className="text-gray-400"> · 持有 {stats.timeHeld}</span>}
                  </div>
                )}
              </>
            }
          />
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              財富自由進度
            </h2>
            <span className="text-xs sm:text-sm font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
              目標:{' '}
              <span className="font-bold text-gray-700">
                ${stats.freedomProgress.targetUSD.toLocaleString()} USD
              </span>
              <span className="hidden sm:inline">
                {' '}
                (約 NT${Math.round(stats.freedomProgress.targetTWD).toLocaleString()})
              </span>
            </span>
          </div>

          <div className="relative h-7 bg-gray-100 rounded-full overflow-hidden mb-3 shadow-inner">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 ease-out flex items-center justify-end px-2"
              style={{ width: `${Math.min(100, stats.freedomProgress.progressPercent)}%` }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 drop-shadow-sm mix-blend-multiply z-10">
              {stats.freedomProgress.progressPercent.toFixed(1)}%
            </div>
            {stats.freedomProgress.progressPercent > 50 && (
              <div
                className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md z-20"
                style={{
                  clipPath: `polygon(0 0, ${stats.freedomProgress.progressPercent}% 0, ${stats.freedomProgress.progressPercent}% 100%, 0 100%)`,
                }}
              >
                {stats.freedomProgress.progressPercent.toFixed(1)}%
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between text-sm text-gray-600 gap-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              目前資產:{' '}
              <span className="font-bold text-blue-600">
                ${stats.freedomProgress.userValueUSDRaw.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {stats.freedomProgress.remainingUSD > 0 ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                  距離目標還差:{' '}
                  <span className="font-bold text-gray-800">
                    ${stats.freedomProgress.remainingUSD.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400">
                    (約 NT$
                    {Math.round(
                      stats.freedomProgress.remainingUSD * stats.freedomProgress.currentRate
                    ).toLocaleString()}
                    )
                  </span>
                </>
              ) : (
                <span className="text-green-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> 恭喜！已達成財富自由目標！
                </span>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 mt-4">
            <button
              onClick={() => setShowProjection(!showProjection)}
              className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
            >
              <Calculator className="w-4 h-4" />{' '}
              {showProjection ? '隱藏進度預測' : '展開達標預測試算'}
            </button>

            {showProjection && (
              <div className="mt-3 bg-blue-50 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center border border-blue-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    預計每年入金 (USD)
                  </label>
                  <input
                    type="number"
                    value={projAnnualDeposit}
                    onChange={(e) => setProjAnnualDeposit(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: 12000"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    預期年化報酬率 (%)
                  </label>
                  <input
                    type="number"
                    value={projAnnualReturn}
                    onChange={(e) => setProjAnnualReturn(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="例: 7"
                  />
                </div>
                <div className="flex-1 w-full text-center sm:text-right mt-2 sm:mt-0 flex flex-col justify-center">
                  {projection.possible ? (
                    projection.years === 0 ? (
                      <span className="text-green-600 font-bold text-lg flex items-center justify-center sm:justify-end gap-1">
                        <CheckCircle2 className="w-5 h-5" /> 已達標！
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500 font-medium">預計還需</span>
                        <span className="text-2xl font-black text-blue-700 leading-tight">
                          {' '}
                          {projection.years.toFixed(1)} <span className="text-base font-bold">年</span>
                        </span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          大約 {new Date().getFullYear() + Math.ceil(projection.years)} 年達成目標
                        </div>
                      </>
                    )
                  ) : (
                    <span className="text-red-500 text-sm font-bold flex items-center justify-center sm:justify-end gap-1">
                      <AlertCircle className="w-4 h-4" /> 目前條件無法達標
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {deposits.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-600" />
                  資產與獲利趨勢 (USD)
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  橘色線為您的歷史資產走勢，請輸入歷史市值以繪製更完整的曲線。
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex flex-wrap gap-2">
                  {['5D', '1M', '6M', 'YTD', '1Y', '5Y', 'Max'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        timeRange === range
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {range === '5D'
                        ? '5天'
                        : range === '1M'
                        ? '1月'
                        : range === '6M'
                        ? '6月'
                        : range === 'YTD'
                        ? '今年'
                        : range === '1Y'
                        ? '1年'
                        : range === '5Y'
                        ? '5年'
                        : '全部'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPnL(!showPnL)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all border ${
                      showPnL
                        ? 'bg-orange-100 border-orange-200 text-orange-700 shadow-sm'
                        : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={showPnL ? '隱藏損益區域' : '顯示損益區域'}
                  >
                    {showPnL ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>損益</span>
                  </button>

                  <div className="flex flex-wrap gap-2 bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center mr-3 px-2 border-r border-gray-200">
                      <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
                      <span className="text-xs font-bold text-gray-600">本金</span>
                    </div>
                    {['QQQ', 'VTI', 'VT'].map((ticker) => {
                      const colors = {
                        QQQ: 'text-purple-600',
                        VTI: 'text-green-600',
                        VT: 'text-blue-600',
                      };
                      const bgColors = {
                        QQQ: 'bg-purple-600',
                        VTI: 'bg-green-600',
                        VT: 'bg-blue-600',
                      };
                      const isActive = visibleBenchmarks[ticker];
                      return (
                        <button
                          key={ticker}
                          onClick={() => toggleBenchmark(ticker)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all border ${
                            isActive
                              ? 'bg-white border-gray-200 shadow-sm'
                              : 'bg-transparent border-transparent text-gray-400 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div
                            className={`w-3 h-1 rounded-full ${
                              isActive ? bgColors[ticker] : 'bg-gray-300'
                            }`}
                          ></div>
                          <span className={isActive ? colors[ticker] : ''}>{ticker}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-[260px] sm:h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorPnLPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorPnLNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  <Area
                    type="stepAfter"
                    dataKey="principal"
                    stroke="#9ca3af"
                    fill="url(#colorPrincipal)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    name="principal"
                    isAnimationActive={false}
                  />

                  {showPnL && (
                    <Area
                      type="monotone"
                      dataKey="MyValue"
                      stroke="none"
                      fill="url(#colorPnLPositive)"
                      connectNulls
                      isAnimationActive={false}
                      legendType="none"
                      tooltipType="none"
                    />
                  )}

                  {visibleBenchmarks.QQQ && (
                    <Line
                      type="monotone"
                      connectNulls
                      dataKey="QQQ"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      name="QQQ"
                      isAnimationActive={false}
                    />
                  )}
                  {visibleBenchmarks.VTI && (
                    <Line
                      type="monotone"
                      connectNulls
                      dataKey="VTI"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="VTI"
                      isAnimationActive={false}
                    />
                  )}
                  {visibleBenchmarks.VT && (
                    <Line
                      type="monotone"
                      connectNulls
                      dataKey="VT"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="VT"
                      isAnimationActive={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    connectNulls
                    dataKey="MyValue"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                    name="MyValue"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-600" /> 績效對決 (假如入金當下 All-in...)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComparisonCard
              symbol="QQQ"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.qqq}
              benchmarkValue={stats.currentQQQValue}
              color="bg-purple-500"
            />
            <ComparisonCard
              symbol="VTI"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.vti}
              benchmarkValue={stats.currentVTIValue}
              color="bg-green-500"
            />
            <ComparisonCard
              symbol="VT"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.vt}
              benchmarkValue={stats.currentVTValue}
              color="bg-blue-500"
            />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <Calendar className="w-5 h-5" /> 資金交易紀錄
            </h2>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> 新增紀錄
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">類型 / 金額 (USD)</th>
                  <th className="px-4 py-3 font-medium">匯率</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">金額 (TWD)</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">QQQ 當時價</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">VTI 當時價</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">VT 當時價</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-400">
                      尚無紀錄，請點擊右上角新增
                    </td>
                  </tr>
                ) : (
                  deposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{dep.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              dep.amount < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {dep.amount < 0 ? '出金' : '入金'}
                          </span>
                          <span className="font-bold text-gray-800">
                            ${(Math.abs(dep.amount) || 0).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{dep.exchangeRate || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {dep.exchangeRate
                          ? `NT$${Math.round(
                              Math.abs(dep.amount) * dep.exchangeRate
                            ).toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        ${dep.qqqPrice}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        ${dep.vtiPrice}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        ${dep.vtPrice}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(dep)}
                            className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(dep.id)}
                            className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={portfolioHistory}
        onAdd={handleAddHistory}
        onUpdate={handleUpdateHistory}
        onDelete={handleDeleteHistory}
      />
      <AiAnalysisModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        stats={stats}
        depositsCount={stats.activeDepositsCount}
      />
      <DataManagementModal
        isOpen={showDataModal}
        onClose={() => setShowDataModal(false)}
        deposits={deposits}
        history={portfolioHistory}
        settings={marketSettings}
        onRestore={(data) => {
          setRestoreData(data);
          setShowRestoreConfirm(true);
        }}
        onUploadMarketData={handleUploadMarketData}
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingDepositId ? '編輯交易紀錄' : '新增交易紀錄'}
              </h2>

              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleScanReceipt}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanningImage}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold rounded-lg transition-colors border border-indigo-100 disabled:opacity-50"
              >
                {isScanningImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">✨ AI 掃描截圖</span>
              </button>
            </div>

            <form onSubmit={handleSaveDeposit} className="space-y-4 relative z-10">
              <div className="flex gap-4 mb-2 p-1 bg-gray-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setNewDeposit({ ...newDeposit, type: 'deposit' })}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${
                    newDeposit.type === 'deposit'
                      ? 'bg-white shadow text-green-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  入金
                </button>
                <button
                  type="button"
                  onClick={() => setNewDeposit({ ...newDeposit, type: 'withdrawal' })}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${
                    newDeposit.type === 'withdrawal'
                      ? 'bg-white shadow text-red-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  出金
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">日期</label>
                  <input
                    type="date"
                    required
                    value={newDeposit.date}
                    onChange={(e) => setNewDeposit({ ...newDeposit, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">金額 (USD)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="1000"
                    value={newDeposit.amount}
                    onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-blue-800 font-medium flex items-center gap-1">
                    <Search className="w-3 h-3" /> 市場數據 (可自動抓取)
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoFillPrices}
                    disabled={isFetchingPrices || !newDeposit.date}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isFetchingPrices ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    {isFetchingPrices ? '搜尋中...' : '智慧填入 (優先查 CSV)'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="w-12 text-sm font-bold text-gray-600">匯率</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="USD/TWD"
                      className="flex-1 border border-gray-300 rounded-md p-1.5 text-sm"
                      value={newDeposit.exchangeRate}
                      onChange={(e) =>
                        setNewDeposit({ ...newDeposit, exchangeRate: e.target.value })
                      }
                    />
                    <div className="w-6"></div>
                  </div>
                  {['QQQ', 'VTI', 'VT'].map((ticker) => (
                    <div key={ticker} className="flex items-center gap-2">
                      <label className="w-12 text-sm font-bold text-gray-600">{ticker}</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder="0.00"
                        className="flex-1 border border-gray-300 rounded-md p-1.5 text-sm"
                        value={
                          ticker === 'QQQ'
                            ? newDeposit.qqqPrice
                            : ticker === 'VTI'
                            ? newDeposit.vtiPrice
                            : newDeposit.vtPrice
                        }
                        onChange={(e) =>
                          setNewDeposit({
                            ...newDeposit,
                            [`${ticker.toLowerCase()}Price`]: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => openSearch(ticker, newDeposit.date)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="手動 Google 搜尋"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium shadow-sm"
                >
                  {editingDepositId ? '儲存修改' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-gray-600" /> 更新市場與資產現值
            </h2>
            <form onSubmit={handleUpdateSettings} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    目前投資總值 (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tempSettings.currentPortfolioValue}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, currentPortfolioValue: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 pl-3 pr-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    目前匯率 (USD/TWD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tempSettings.currentExchangeRate}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, currentExchangeRate: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 pl-3 pr-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  財富自由目標金額 (USD)
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <input
                    type="number"
                    step="1000"
                    required
                    value={tempSettings.targetAmountUSD || 1000000}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, targetAmountUSD: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 pl-3 pr-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg"
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap bg-gray-50 px-2 py-1 rounded">
                    約 NT${' '}
                    {Math.round(
                      (tempSettings.targetAmountUSD || 1000000) *
                        (tempSettings.currentExchangeRate || 30)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  今日市場價格 (用於計算基準價值)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['QQQ', 'VTI', 'VT'].map((ticker) => (
                    <div key={ticker}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        {ticker} 現價
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={tempSettings[`current${ticker}`]}
                        onChange={(e) =>
                          setTempSettings({
                            ...tempSettings,
                            [`current${ticker}`]: e.target.value,
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right">
                  <a
                    href="https://finance.yahoo.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center justify-end gap-1"
                  >
                    前往 Yahoo Finance 查看 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium shadow-sm"
                >
                  儲存更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        title="確定要刪除這筆紀錄嗎？"
        message="此動作無法復原，刪除後您的歷史績效計算將會重新調整。"
        onCancel={() => setDeleteId(null)}
        onConfirm={executeDeleteDeposit}
        isDestructive={true}
      />
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="還原備份資料"
        message="此操作將會讀取備份檔案並寫入資料庫。如果資料ID重複，將會更新現有資料。"
        onCancel={() => {
          setShowRestoreConfirm(false);
          setRestoreData(null);
        }}
        onConfirm={executeRestoreData}
      />
    </div>
  );
}
