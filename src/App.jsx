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
import { fetchLatestPrices, fetchHistoricalPrices } from './lib/priceFetcher.js';

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
  const [marketData, setMarketData] = useState({ QQQ: [], VTI: [], VT: [], QLD: [], SOXX: [] });
  const [marketSettings, setMarketSettings] = useState({
    currentPortfolioValue: 0,
    currentExchangeRate: 32.5,
    currentQQQ: 0,
    currentVTI: 0,
    currentVT: 0,
    currentQLD: 0,
    currentSOXX: 0,
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
  const [isBackfillingTicker, setIsBackfillingTicker] = useState(null);
  const autoBootstrappedRef = useRef(false);
  const fileInputRef = useRef(null);

  const [deleteId, setDeleteId] = useState(null);
  const [restoreData, setRestoreData] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const [visibleBenchmarks, setVisibleBenchmarks] = useState({
    QQQ: true,
    VTI: false,
    VT: false,
    QLD: false,
    SOXX: false,
  });

  const [newDeposit, setNewDeposit] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'deposit',
    amount: '',
    exchangeRate: '',
    qqqPrice: '',
    vtiPrice: '',
    vtPrice: '',
    qldPrice: '',
    soxxPrice: '',
  });

  const [tempSettings, setTempSettings] = useState({ ...marketSettings });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        return;
      }
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error', err);
      }
    });
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
      const tickers = ['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'];
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
      autoUpdateLatestPrices(newData);
    };

    const autoUpdateLatestPrices = async (existingData) => {
      try {
        const latest = await fetchLatestPrices();
        const tickers = ['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'];
        const merged = { ...existingData };
        const settingsUpdate = {};
        let anyAppended = false;

        for (const ticker of tickers) {
          const entry = latest[ticker];
          if (!entry) continue;
          const existing = merged[ticker] || [];
          const maxDate = existing.reduce(
            (max, p) => (p.date > max ? p.date : max),
            ''
          );
          if (entry.date > maxDate) {
            const next = [...existing, entry].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
            merged[ticker] = next;
            await setDoc(
              doc(db, 'artifacts', appId, 'users', user.uid, 'marketData', ticker),
              { prices: next, updatedAt: new Date().toISOString() }
            );
            anyAppended = true;
          }
          if (ticker === 'QQQ') settingsUpdate.currentQQQ = entry.close;
          if (ticker === 'VTI') settingsUpdate.currentVTI = entry.close;
          if (ticker === 'VT') settingsUpdate.currentVT = entry.close;
          if (ticker === 'QLD') settingsUpdate.currentQLD = entry.close;
          if (ticker === 'SOXX') settingsUpdate.currentSOXX = entry.close;
        }

        if (Object.keys(settingsUpdate).length > 0) {
          settingsUpdate.lastAutoFetched = new Date().toISOString();
          await setDoc(
            doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'marketData'),
            settingsUpdate,
            { merge: true }
          );
        }

        if (anyAppended) {
          setMarketData(merged);
        }
      } catch (e) {
        console.warn('[auto-update] failed:', e.message);
      }
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
          message: '掃描成功,已自動填入資料。建議點擊「智慧填入」補齊股價。',
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

    const localPrices = { qqq: null, vti: null, vt: null, qld: null, soxx: null };
    const today = new Date().toISOString().split('T')[0];
    const isTodayOrFuture = newDeposit.date >= today;

    // For PAST dates: use local marketData (Stooq historical CSV).
    // For TODAY/FUTURE: skip local cache and force an AI search for the
    // official close — /q/l/ and marketSettings.currentX can hold an
    // intraday last price (e.g. $717.91 when the official close is
    // $701.53), which is the wrong number for a "當時價" field.
    if (!isTodayOrFuture) {
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
      localPrices.qld = findLocalPrice('QLD');
      localPrices.soxx = findLocalPrice('SOXX');

      setNewDeposit((prev) => ({
        ...prev,
        qqqPrice: localPrices.qqq || prev.qqqPrice,
        vtiPrice: localPrices.vti || prev.vtiPrice,
        vtPrice: localPrices.vt || prev.vtPrice,
        qldPrice: localPrices.qld || prev.qldPrice,
        soxxPrice: localPrices.soxx || prev.soxxPrice,
      }));
    }

    const missingStocks =
      isTodayOrFuture ||
      !localPrices.qqq ||
      !localPrices.vti ||
      !localPrices.vt ||
      !localPrices.qld ||
      !localPrices.soxx;
    const missingRate = !newDeposit.exchangeRate;

    if (missingStocks || missingRate) {
      try {
        const prompt = `
            Find the official daily CLOSING PRICES (the last regular-session trade at 4:00 PM ET, as published by the exchange) for these US ETFs on ${newDeposit.date}.
            Do NOT return the high, low, open, intraday last, pre-market, or after-hours price.

            I have these values from local data:
            QQQ: ${localPrices.qqq || 'MISSING'}
            VTI: ${localPrices.vti || 'MISSING'}
            VT: ${localPrices.vt || 'MISSING'}
            QLD: ${localPrices.qld || 'MISSING'}
            SOXX: ${localPrices.soxx || 'MISSING'}
            Rate: ${newDeposit.exchangeRate || 'MISSING'}

            Please find the MISSING closing prices for ${newDeposit.date}.
            For Exchange Rate (USD to TWD), ALWAYS find it.

            Rules:
            - If ${newDeposit.date} is today and the US market hasn't closed yet (before 4:00 PM ET), use the previous trading day's close.
            - If ${newDeposit.date} is a weekend or US market holiday, use the previous trading day's close.
            - Output ONLY valid JSON. No markdown, no commentary.

            JSON Format:
            {
              "qqq": number (only if missing),
              "vti": number (only if missing),
              "vt": number (only if missing),
              "qld": number (only if missing),
              "soxx": number (only if missing),
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
            qldPrice: aiPrices.qld || prev.qldPrice,
            soxxPrice: aiPrices.soxx || prev.soxxPrice,
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
    let totalQLDShares = 0;
    let totalSOXXShares = 0;
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
      if (d.qldPrice > 0) totalQLDShares += amt / parseFloat(d.qldPrice);
      if (d.soxxPrice > 0) totalSOXXShares += amt / parseFloat(d.soxxPrice);
    });

    const currentQQQValue = totalQQQShares * (marketSettings.currentQQQ || 0);
    const currentVTIValue = totalVTIShares * (marketSettings.currentVTI || 0);
    const currentVTValue = totalVTShares * (marketSettings.currentVT || 0);
    const currentQLDValue = totalQLDShares * (marketSettings.currentQLD || 0);
    const currentSOXXValue = totalSOXXShares * (marketSettings.currentSOXX || 0);

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
      currentQLDValue,
      currentSOXXValue,
      activeDepositsCount,
      benchmarkReturns: {
        qqq: currentQQQValue - totalInvestedUSD,
        vti: currentVTIValue - totalInvestedUSD,
        vt: currentVTValue - totalInvestedUSD,
        qld: currentQLDValue - totalInvestedUSD,
        soxx: currentSOXXValue - totalInvestedUSD,
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
    ['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].forEach((ticker) => {
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

    const marketPriceMap = {
      QQQ: new Map(),
      VTI: new Map(),
      VT: new Map(),
      QLD: new Map(),
      SOXX: new Map(),
    };
    ['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].forEach((ticker) => {
      marketData[ticker]?.forEach((p) => marketPriceMap[ticker].set(p.date, p.close));
    });

    let cumPrincipal = 0;
    let cumQQQShares = 0;
    let cumVTIShares = 0;
    let cumVTShares = 0;
    let cumQLDShares = 0;
    let cumSOXXShares = 0;

    let lastPriceQQQ = null;
    let lastPriceVTI = null;
    let lastPriceVT = null;
    let lastPriceQLD = null;
    let lastPriceSOXX = null;

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
          if (d.qldPrice > 0) cumQLDShares += amt / parseFloat(d.qldPrice);
          if (d.soxxPrice > 0) cumSOXXShares += amt / parseFloat(d.soxxPrice);
        });
      }

      let priceQQQ = null;
      let priceVTI = null;
      let priceVT = null;
      let priceQLD = null;
      let priceSOXX = null;

      if (isNow) {
        priceQQQ = parseFloat(marketSettings.currentQQQ);
        priceVTI = parseFloat(marketSettings.currentVTI);
        priceVT = parseFloat(marketSettings.currentVT);
        priceQLD = parseFloat(marketSettings.currentQLD);
        priceSOXX = parseFloat(marketSettings.currentSOXX);
      } else {
        priceQQQ = marketPriceMap.QQQ.get(date);
        priceVTI = marketPriceMap.VTI.get(date);
        priceVT = marketPriceMap.VT.get(date);
        priceQLD = marketPriceMap.QLD.get(date);
        priceSOXX = marketPriceMap.SOXX.get(date);

        if (!priceQQQ && depositMap.has(date)) priceQQQ = parseFloat(depositMap.get(date)[0].qqqPrice);
        if (!priceVTI && depositMap.has(date)) priceVTI = parseFloat(depositMap.get(date)[0].vtiPrice);
        if (!priceVT && depositMap.has(date)) priceVT = parseFloat(depositMap.get(date)[0].vtPrice);
        if (!priceQLD && depositMap.has(date)) priceQLD = parseFloat(depositMap.get(date)[0].qldPrice);
        if (!priceSOXX && depositMap.has(date)) priceSOXX = parseFloat(depositMap.get(date)[0].soxxPrice);

        if (priceQQQ) lastPriceQQQ = priceQQQ;
        if (priceVTI) lastPriceVTI = priceVTI;
        if (priceVT) lastPriceVT = priceVT;
        if (priceQLD) lastPriceQLD = priceQLD;
        if (priceSOXX) lastPriceSOXX = priceSOXX;

        if (!priceQQQ && lastPriceQQQ) priceQQQ = lastPriceQQQ;
        if (!priceVTI && lastPriceVTI) priceVTI = lastPriceVTI;
        if (!priceVT && lastPriceVT) priceVT = lastPriceVT;
        if (!priceQLD && lastPriceQLD) priceQLD = lastPriceQLD;
        if (!priceSOXX && lastPriceSOXX) priceSOXX = lastPriceSOXX;
      }

      const point = {
        date,
        principal: cumPrincipal,
        QQQ: priceQQQ ? cumQQQShares * priceQQQ : null,
        VTI: priceVTI ? cumVTIShares * priceVTI : null,
        VT: priceVT ? cumVTShares * priceVT : null,
        QLD: priceQLD ? cumQLDShares * priceQLD : null,
        SOXX: priceSOXX ? cumSOXXShares * priceSOXX : null,
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
      qldPrice: '',
      soxxPrice: '',
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
      qldPrice: deposit.qldPrice || '',
      soxxPrice: deposit.soxxPrice || '',
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
      qldPrice: parseFloat(newDeposit.qldPrice) || 0,
      soxxPrice: parseFloat(newDeposit.soxxPrice) || 0,
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

  const depositsRef = useRef(deposits);
  useEffect(() => {
    depositsRef.current = deposits;
  }, [deposits]);

  const runBackfill = async (ticker, { silent = false } = {}) => {
    if (!user) return { skipped: 0, updated: 0, count: 0 };
    const priceField = `${ticker.toLowerCase()}Price`;
    setIsBackfillingTicker(ticker);
    try {
      const history = await fetchHistoricalPrices(ticker);

      // Stooq's daily CSV is dividend-adjusted and can lag the latest trading
      // day. Preserve any existing entries that are strictly newer than the
      // history we just fetched — those typically come from /q/l/ (real-time,
      // unadjusted) via autoUpdateLatestPrices and we don't want to lose them.
      const maxHistoryDate = history.reduce(
        (max, h) => (h.date > max ? h.date : max),
        ''
      );
      const existing = marketData[ticker] || [];
      const preserved = existing.filter((e) => e.date > maxHistoryDate);
      const stored =
        preserved.length > 0
          ? [...history, ...preserved].sort((a, b) => a.date.localeCompare(b.date))
          : history;

      await setDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'marketData', ticker),
        { prices: stored, updatedAt: new Date().toISOString() }
      );
      setMarketData((prev) => ({ ...prev, [ticker]: stored }));

      const findClosest = (date) => {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].date <= date) return history[i].close;
        }
        return null;
      };

      const candidates = depositsRef.current.filter(
        (d) => !d[priceField] || parseFloat(d[priceField]) <= 0
      );
      let updated = 0;
      let skipped = 0;
      const batch = writeBatch(db);
      candidates.forEach((dep) => {
        const price = findClosest(dep.date);
        if (price) {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'deposits', dep.id);
          batch.update(ref, { [priceField]: price, updatedAt: new Date().toISOString() });
          updated++;
        } else {
          skipped++;
        }
      });
      if (updated > 0) await batch.commit();

      if (!silent) {
        const skipMsg = skipped > 0 ? `、跳過 ${skipped} 筆 (日期早於 ${ticker} 上市)` : '';
        setNotification({
          type: 'success',
          message: `${ticker} 歷史 ${history.length} 筆寫入完成,補齊 ${updated} 筆交易紀錄${skipMsg}。`,
        });
      }
      return { count: history.length, updated, skipped };
    } catch (err) {
      console.error(`Backfill ${ticker} error:`, err);
      if (!silent) {
        setNotification({
          type: 'error',
          message: `${ticker} 補齊失敗:${err.message}`,
        });
      }
      throw err;
    } finally {
      setIsBackfillingTicker(null);
    }
  };

  const handleBackfillTicker = (ticker) => runBackfill(ticker);

  useEffect(() => {
    if (!user || loading || autoBootstrappedRef.current) return;
    const tickers = ['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'];
    const missing = tickers.filter(
      (t) => !marketData[t] || marketData[t].length === 0
    );
    if (missing.length === 0) return;

    autoBootstrappedRef.current = true;

    (async () => {
      setNotification({
        type: 'success',
        message: `偵測到 ${missing.length} 個標的尚無歷史價,自動補齊中...`,
      });
      let success = 0;
      let totalUpdated = 0;
      const failed = [];
      for (const t of missing) {
        try {
          const r = await runBackfill(t, { silent: true });
          success++;
          totalUpdated += r.updated;
        } catch {
          failed.push(t);
        }
      }
      setNotification({
        type: failed.length === 0 ? 'success' : 'error',
        message:
          failed.length === 0
            ? `自動補齊完成,${success} 個標的、補上 ${totalUpdated} 筆舊紀錄`
            : `自動補齊 ${success}/${missing.length},失敗:${failed.join(', ')}`,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, marketData]);

  const handleBackfillAll = async () => {
    if (!user || isBackfillingTicker) return;
    const tickers = ['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'];
    setNotification({
      type: 'success',
      message: `開始補齊全部 ${tickers.length} 個標的的歷史股價...`,
    });
    let success = 0;
    let totalUpdated = 0;
    const failed = [];
    for (const t of tickers) {
      try {
        const r = await runBackfill(t, { silent: true });
        success++;
        totalUpdated += r.updated;
      } catch {
        failed.push(t);
      }
    }
    setNotification({
      type: failed.length === 0 ? 'success' : 'error',
      message:
        failed.length === 0
          ? `全部補齊完成,共補上 ${totalUpdated} 筆舊紀錄當時價`
          : `補齊完成 ${success}/${tickers.length},失敗:${failed.join(', ')}`,
    });
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
      currentQLD: parseFloat(tempSettings.currentQLD) || 0,
      currentSOXX: parseFloat(tempSettings.currentSOXX) || 0,
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
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 text-sm">
        載入中...
      </div>
    );
  }

  const navBtn =
    'flex items-center gap-1.5 text-sm bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg border border-slate-200 transition-colors';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap gap-y-2 gap-x-3 justify-between items-center">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight truncate">
                Portfolio Performance
              </h1>
              <p className="text-[11px] text-slate-500 tracking-wide hidden sm:block">
                ETF All-in 績效對比
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">AI 績效診斷</span>
            </button>
            <button
              onClick={() => {
                setTempSettings(marketSettings);
                setShowSettingsModal(true);
              }}
              className={navBtn}
            >
              <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">更新現價</span>
            </button>
            <button onClick={() => setShowHistoryModal(true)} className={navBtn}>
              <History className="w-4 h-4" /> <span className="hidden sm:inline">紀錄歷史</span>
            </button>
            <button onClick={() => setShowDataModal(true)} className={navBtn}>
              <Database className="w-4 h-4" /> <span className="hidden sm:inline">資料管理</span>
            </button>
            {user && !user.isAnonymous ? (
              <button
                onClick={handleSignOut}
                title={user.email || user.displayName || ''}
                className={navBtn}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {user.displayName || user.email || '登出'}
                </span>
              </button>
            ) : (
              <button onClick={handleGoogleSignIn} className={navBtn}>
                <LogIn className="w-4 h-4" /> <span className="hidden sm:inline">登入 Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="總投入本金"
            valueUSD={`${stats.totalInvestedUSD}`}
            valueTWD={`${stats.totalInvestedTWD}`}
            subtext={`${stats.activeDepositsCount} 筆交易紀錄`}
          />
          <StatCard
            title="目前投資總市值"
            valueUSD={`${stats.userValueUSD}`}
            valueTWD={`${stats.userValueTWD}`}
            highlight
            subtext={`匯率基準  1 USD ≈ ${marketSettings.currentExchangeRate} TWD`}
          />
          <StatCard
            title="總投資報酬率"
            valueUSD={`${stats.userRoiUSD > 0 ? '+' : ''}${stats.userRoiUSD.toFixed(2)}%`}
            valueTWD={`${stats.userRoiTWD > 0 ? '+' : ''}${stats.userRoiTWD.toFixed(2)}%`}
            colorClass={stats.userRoiUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            subtext={
              <>
                <div className="tabular-nums">
                  損益 ${Math.round(stats.userReturnUSD).toLocaleString()}
                </div>
                {stats.annualizedPct != null && (
                  <div>
                    年化 (XIRR){' '}
                    <span
                      className={`tabular-nums font-semibold ${
                        stats.annualizedPct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {stats.annualizedPct >= 0 ? '+' : ''}
                      {stats.annualizedPct.toFixed(2)}%
                    </span>
                    {stats.timeHeld && (
                      <span className="text-slate-400"> · 持有 {stats.timeHeld}</span>
                    )}
                  </div>
                )}
              </>
            }
          />
        </div>
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                財富自由進度
              </h2>
              <p className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight mt-1">
                {stats.freedomProgress.progressPercent.toFixed(1)}
                <span className="text-base text-slate-400 font-normal">%</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">目標</p>
              <p className="text-sm font-semibold text-slate-900 tabular-nums mt-1">
                ${stats.freedomProgress.targetUSD.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 tabular-nums hidden sm:block">
                NT${Math.round(stats.freedomProgress.targetTWD).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="absolute top-0 left-0 h-full bg-slate-900 transition-all duration-700 ease-out rounded-full"
              style={{ width: `${Math.min(100, stats.freedomProgress.progressPercent)}%` }}
            ></div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between text-sm gap-1.5">
            <div className="flex items-center gap-2 text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
              <span>目前資產</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                ${stats.freedomProgress.userValueUSDRaw.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              {stats.freedomProgress.remainingUSD > 0 ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  <span>還差</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    ${stats.freedomProgress.remainingUSD.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    NT$
                    {Math.round(
                      stats.freedomProgress.remainingUSD * stats.freedomProgress.currentRate
                    ).toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> 已達成財富自由目標
                </span>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-5">
            <button
              onClick={() => setShowProjection(!showProjection)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />{' '}
              {showProjection ? '隱藏達標預測' : '展開達標預測'}
            </button>

            {showProjection && (
              <div className="mt-4 bg-slate-50 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center border border-slate-200 animate-fade-in">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    每年入金 (USD)
                  </label>
                  <input
                    type="number"
                    value={projAnnualDeposit}
                    onChange={(e) => setProjAnnualDeposit(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                    placeholder="12000"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    預期年化報酬 (%)
                  </label>
                  <input
                    type="number"
                    value={projAnnualReturn}
                    onChange={(e) => setProjAnnualReturn(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                    placeholder="7"
                  />
                </div>
                <div className="flex-1 w-full text-center sm:text-right mt-2 sm:mt-0 flex flex-col justify-center">
                  {projection.possible ? (
                    projection.years === 0 ? (
                      <span className="text-emerald-600 font-semibold text-base flex items-center justify-center sm:justify-end gap-1">
                        <CheckCircle2 className="w-5 h-5" /> 已達標
                      </span>
                    ) : (
                      <>
                        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                          預計還需
                        </span>
                        <span className="text-3xl font-semibold text-slate-900 leading-tight tabular-nums tracking-tight">
                          {projection.years.toFixed(1)}
                          <span className="text-base font-normal text-slate-500 ml-1">年</span>
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                          約 {new Date().getFullYear() + Math.ceil(projection.years)} 年達成
                        </div>
                      </>
                    )
                  ) : (
                    <span className="text-rose-600 text-sm font-medium flex items-center justify-center sm:justify-end gap-1">
                      <AlertCircle className="w-4 h-4" /> 目前條件無法達標
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {deposits.length > 0 && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  資產走勢
                </h2>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  歷史資產與基準比較 <span className="text-slate-400 font-normal">(USD)</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
                  {['5D', '1M', '6M', 'YTD', '1Y', '5Y', 'Max'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        timeRange === range
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                onClick={() => setShowPnL(!showPnL)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors border ${
                  showPnL
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                title={showPnL ? '隱藏損益區域' : '顯示損益區域'}
              >
                {showPnL ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>損益</span>
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1"></div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-white border border-slate-200 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>本金</span>
              </div>
              {['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].map((ticker) => {
                const dotColors = {
                  QQQ: 'bg-violet-500',
                  VTI: 'bg-emerald-500',
                  VT: 'bg-sky-500',
                  QLD: 'bg-pink-500',
                  SOXX: 'bg-cyan-500',
                };
                const isActive = visibleBenchmarks[ticker];
                return (
                  <button
                    key={ticker}
                    onClick={() => toggleBenchmark(ticker)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? dotColors[ticker] : 'bg-slate-300'
                      }`}
                    ></span>
                    <span>{ticker}</span>
                  </button>
                );
              })}
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
                  {visibleBenchmarks.QLD && (
                    <Line
                      type="monotone"
                      connectNulls
                      dataKey="QLD"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={false}
                      name="QLD"
                      isAnimationActive={false}
                    />
                  )}
                  {visibleBenchmarks.SOXX && (
                    <Line
                      type="monotone"
                      connectNulls
                      dataKey="SOXX"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                      name="SOXX"
                      isAnimationActive={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    connectNulls
                    dataKey="MyValue"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#0f172a', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 5 }}
                    name="MyValue"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div>
          <div className="mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> 績效對決
            </h2>
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              假如入金當下 All-in 各標的的理論市值
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <ComparisonCard
              symbol="QQQ"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.qqq}
              benchmarkValue={stats.currentQQQValue}
              color="bg-violet-500"
            />
            <ComparisonCard
              symbol="VTI"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.vti}
              benchmarkValue={stats.currentVTIValue}
              color="bg-emerald-500"
            />
            <ComparisonCard
              symbol="VT"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.vt}
              benchmarkValue={stats.currentVTValue}
              color="bg-sky-500"
            />
            <ComparisonCard
              symbol="QLD"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.qld}
              benchmarkValue={stats.currentQLDValue}
              color="bg-pink-500"
            />
            <ComparisonCard
              symbol="SOXX"
              userTotalReturn={stats.userReturnUSD}
              benchmarkTotalReturn={stats.benchmarkReturns.soxx}
              benchmarkValue={stats.currentSOXXValue}
              color="bg-cyan-500"
            />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> 資金交易紀錄
              </h2>
              <p className="text-sm font-medium text-slate-700 mt-0.5">
                {deposits.length} 筆紀錄
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 新增紀錄
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr className="text-[11px] uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">類型 / 金額</th>
                  <th className="px-4 py-3 font-medium">匯率</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">TWD</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">QQQ</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">VTI</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">VT</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">QLD</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">SOXX</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-12 text-center text-slate-400 text-sm">
                      尚無紀錄,點擊右上角新增
                    </td>
                  </tr>
                ) : (
                  deposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-900 tabular-nums">
                        {dep.date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide ${
                              dep.amount < 0
                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}
                          >
                            {dep.amount < 0 ? '出金' : '入金'}
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            ${(Math.abs(dep.amount) || 0).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">
                        {dep.exchangeRate || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell tabular-nums">
                        {dep.exchangeRate
                          ? `NT$${Math.round(
                              Math.abs(dep.amount) * dep.exchangeRate
                            ).toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell tabular-nums">
                        {dep.qqqPrice ? `$${dep.qqqPrice}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell tabular-nums">
                        {dep.vtiPrice ? `$${dep.vtiPrice}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell tabular-nums">
                        {dep.vtPrice ? `$${dep.vtPrice}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell tabular-nums">
                        {dep.qldPrice ? `$${dep.qldPrice}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell tabular-nums">
                        {dep.soxxPrice ? `$${dep.soxxPrice}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(dep)}
                            className="text-slate-400 hover:text-slate-900 p-1 transition-colors"
                            title="編輯"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(dep.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
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
        onBackfillTicker={handleBackfillTicker}
        onBackfillAll={handleBackfillAll}
        isBackfillingTicker={isBackfillingTicker}
      />

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 max-w-md w-full p-6 animate-fade-in relative overflow-hidden">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                  {editingDepositId ? '編輯交易紀錄' : '新增交易紀錄'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">填入金額與當時的市場價格</p>
              </div>

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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
              >
                {isScanningImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">AI 掃描截圖</span>
              </button>
            </div>

            <form onSubmit={handleSaveDeposit} className="space-y-4 relative z-10">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setNewDeposit({ ...newDeposit, type: 'deposit' })}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    newDeposit.type === 'deposit'
                      ? 'bg-white shadow-sm text-emerald-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  入金
                </button>
                <button
                  type="button"
                  onClick={() => setNewDeposit({ ...newDeposit, type: 'withdrawal' })}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    newDeposit.type === 'withdrawal'
                      ? 'bg-white shadow-sm text-rose-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  出金
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    日期
                  </label>
                  <input
                    type="date"
                    required
                    value={newDeposit.date}
                    onChange={(e) => setNewDeposit({ ...newDeposit, date: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    金額 (USD)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="1000"
                    value={newDeposit.amount}
                    onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Search className="w-3 h-3" /> 市場數據
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoFillPrices}
                    disabled={isFetchingPrices || !newDeposit.date}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 text-white flex items-center gap-1 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isFetchingPrices ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    {isFetchingPrices ? '搜尋中' : '智慧填入'}
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="w-12 text-xs font-medium text-slate-600">匯率</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      placeholder="USD/TWD"
                      className="flex-1 border border-slate-200 rounded-md px-2.5 py-1.5 text-sm bg-white tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                      value={newDeposit.exchangeRate}
                      onChange={(e) =>
                        setNewDeposit({ ...newDeposit, exchangeRate: e.target.value })
                      }
                    />
                    <div className="w-6"></div>
                  </div>
                  {['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].map((ticker) => (
                    <div key={ticker} className="flex items-center gap-2">
                      <label className="w-12 text-xs font-medium text-slate-600">{ticker}</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder="0.00"
                        className="flex-1 border border-slate-200 rounded-md px-2.5 py-1.5 text-sm bg-white tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                        value={newDeposit[`${ticker.toLowerCase()}Price`]}
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
                        className="text-slate-400 hover:text-slate-900 p-1 transition-colors"
                        title="手動 Google 搜尋"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {editingDepositId ? '儲存修改' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 max-w-md w-full p-6 animate-fade-in">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-500" /> 更新市場與資產現值
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">同步當前資產與基準價</p>
            </div>
            <form onSubmit={handleUpdateSettings} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    投資總值 (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tempSettings.currentPortfolioValue}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, currentPortfolioValue: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base font-semibold tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                    匯率 (USD/TWD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={tempSettings.currentExchangeRate}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, currentExchangeRate: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base font-semibold tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
                  財富自由目標 (USD)
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
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base font-semibold tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                  />
                  <span className="text-[11px] text-slate-500 whitespace-nowrap bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md tabular-nums">
                    NT$
                    {Math.round(
                      (tempSettings.targetAmountUSD || 1000000) *
                        (tempSettings.currentExchangeRate || 30)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-3">
                  今日市場價格
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {['QQQ', 'VTI', 'VT', 'QLD', 'SOXX'].map((ticker) => (
                    <div key={ticker}>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">
                        {ticker}
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
                        className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm tabular-nums focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right">
                  <a
                    href="https://finance.yahoo.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
                  >
                    Yahoo Finance <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
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
