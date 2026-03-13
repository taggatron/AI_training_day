import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, push, get } from "firebase/database";
import {
  User, Star, Monitor, Play, Scissors, Sparkles, X, Clock, Calendar,
  TrendingUp, Activity, AlertTriangle, RefreshCw
} from 'lucide-react';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyARK90mp2xbhKBsU7tcfVGdh9U5lmeKcmE",
  authDomain: "aihairsalon.firebaseapp.com",
  databaseURL: "https://aihairsalon-default-rtdb.firebaseio.com",
  projectId: "aihairsalon",
  storageBucket: "aihairsalon.firebasestorage.app",
  messagingSenderId: "745084117511",
  appId: "1:745084117511:web:e4791d873fae79eae740a2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- GEMINI API SETUP ---
const GEMINI_API_KEY = "AIzaSyAwJHbjewrtZ6MTDjcavKoxfvzKJYSRTfE";

// --- STYLES ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Playfair+Display:ital,wght@0,600;1,600&display=swap');

  html, body { overscroll-behavior: none; }

  .glass-panel {
    background: rgba(39, 39, 42, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  @keyframes float {
    0% { transform: translateY(0px); opacity: 1; }
    100% { transform: translateY(-30px); opacity: 0; }
  }
  .animate-float { animation: float 1.5s ease-out forwards; }

  .graph-tooltip { opacity: 0; transition: opacity 0.2s; pointer-events: none; }
  .graph-point:hover + .graph-tooltip { opacity: 1; }

  @keyframes slowspin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow { animation: slowspin 2s linear infinite; }
`;

const NAMES = ["Alex", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Quinn", "Skyler"];

// Service unlock rules (purchase + staff skill gate)
const SERVICE_UNLOCKS = {
  color: { reqSkill: 3, cost: 450, label: "Color & Tint" },
  style: { reqSkill: 5, cost: 900, label: "Premium Style" }
};

// --- MAIN COMPONENT ---
export default function LuxeSalonGame() {
  // --- CORE STATE ---
  const [view, setView] = useState('lobby');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [activeRooms, setActiveRooms] = useState({});
  const [roomStatus, setRoomStatus] = useState('active');

  // Host Data
  const [hostPlayersData, setHostPlayersData] = useState({});
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [refreshMode, setRefreshMode] = useState('live'); // 'live' or '5s'
  const [pollCountdown, setPollCountdown] = useState(5);

  // Player UI State
  const [activeTab, setActiveTab] = useState('services');
  const [notifications, setNotifications] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);

  // Modals
  const [aiModal, setAiModal] = useState({ open: false, content: '', loading: false });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  // --- GAME STATE REF ---
  const gameStateRef = useRef({
    money: 650,
    reputation: 10,
    time: 540,
    day: 1,
    services: {
      cut: { name: "Basic Cut", price: 25, unlocked: true, basePrice: 25 },
      color: { name: "Color & Tint", price: 60, unlocked: false, basePrice: 60 },
      style: { name: "Premium Style", price: 120, unlocked: false, basePrice: 120 }
    },
    staff: [{
      id: Date.now(), name: "You", skill: 5, speed: 5, energy: 100, state: 'IDLE', currentTask: null
    }],
    customers: [],
    stations: 3,
    maxStations: 6
  });

  const [, setTick] = useState(0);
  const playerIdRef = useRef(null);

  // --- STAT HELPERS ---
  const clampStat = (v, min = 1, max = 10) => Math.max(min, Math.min(max, v));

  const statLabel = (value) => {
    const v = clampStat(value);
    if (v >= 9) return "Master";
    if (v >= 7) return "Advanced";
    if (v >= 5) return "Skilled";
    if (v >= 3) return "Junior";
    return "Trainee";
  };

  const getHighestSkill = (state) => {
    const vals = (state.staff || []).map(s => clampStat(s.skill));
    return vals.length ? Math.max(...vals) : 1;
  };

  // --- LOBBY LISTENER ---
  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    return onValue(roomsRef, (snapshot) => {
      setActiveRooms(snapshot.val() || {});
    });
  }, []);

  // --- GEMINI FUNCTION ---
  const callGemini = async (prompt) => {
    if (!GEMINI_API_KEY) return "Please check API Key configuration.";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Failed to connect to AI Coach.";
    }
  };

  // --- HOST ACTIONS ---
  const handleCreateHost = async () => {
    if (!roomId) return alert("Enter a Room Code");
    const safeRoomId = roomId.toUpperCase();
    await set(ref(db, `rooms/${safeRoomId}`), { created: Date.now(), status: 'active', players: {} });
    setRoomId(safeRoomId);
    setView('host');
  };

  const triggerEndGame = () => {
    setConfirmModal({
      open: true,
      title: "End Game?",
      message: "Are you sure? This will stop the game for all connected players and generate analytics.",
      onConfirm: async () => {
        await update(ref(db, `rooms/${roomId}`), { status: 'ended' });
        setShowAnalysis(true);
        setConfirmModal({ open: false });
      }
    });
  };

  // --- PLAYER ACTIONS ---
  const handleJoinGame = async () => {
    if (!roomId || !playerName) return alert("Enter Room Code and Name");
    const safeRoomId = roomId.toUpperCase();

    const snapshot = await get(ref(db, `rooms/${safeRoomId}`));
    if (!snapshot.exists()) return alert("Room does not exist!");
    if (snapshot.val().status === 'ended') return alert("This game has already ended!");

    playerIdRef.current = 'player_' + Date.now();
    await set(ref(db, `rooms/${safeRoomId}/players/${playerIdRef.current}`), {
      name: playerName,
      metrics: gameStateRef.current,
      history: []
    });

    setRoomId(safeRoomId);
    logEvent("START_GAME", "Opened Salon", 0, safeRoomId);
    setView('player');
  };

  // --- HOST SYNC (LIVE vs POLL) ---
  useEffect(() => {
    if (view !== 'host') return;

    const roomRef = ref(db, `rooms/${roomId}`);

    if (refreshMode === 'live') {
      const unsub = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setHostPlayersData(data.players || {});
          setRoomStatus(data.status);
          if (data.status === 'ended') setShowAnalysis(true);
        }
      });
      return () => unsub();
    } else {
      const fetchOnce = () => {
        get(roomRef).then((snapshot) => {
          const data = snapshot.val();
          if (data) {
            setHostPlayersData(data.players || {});
            setRoomStatus(data.status);
            if (data.status === 'ended') setShowAnalysis(true);
          }
          setPollCountdown(5); // reset countdown on each poll fetch
        });
      };

      fetchOnce();
      const intervalId = setInterval(fetchOnce, 5000);
      return () => clearInterval(intervalId);
    }
  }, [view, roomId, refreshMode]);

  // --- HOST 5s COUNTDOWN TIMER (UI ONLY) ---
  useEffect(() => {
    if (view !== 'host') return;
    if (refreshMode !== '5s') return;

    setPollCountdown(5);
    const t = setInterval(() => {
      setPollCountdown(prev => (prev <= 1 ? 1 : prev - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [view, refreshMode]);

  // --- HELPERS ---
  const endDay = (state) => {
    state.day++;
    state.time = 540;
    const cost = (state.staff.length * 50) + 100;
    state.money -= cost;
    notify(`Day Ended. Expenses: -$${cost}`, 'neutral');
  };

  const notify = (msg, type) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3000);
  };

  const showFloatingText = (staffId, text, type) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(p => [...p, { id, staffId, text, type }]);
    setTimeout(() => setFloatingTexts(p => p.filter(t => t.id !== id)), 1500);
  };

  const logEvent = (type, detail, cost, rId = roomId) => {
    if (!playerIdRef.current) return;
    const historyRef = ref(db, `rooms/${rId}/players/${playerIdRef.current}/history`);
    push(historyRef, {
      timestamp: Date.now(),
      type, detail, profitAtTime: gameStateRef.current.money
    });
    update(ref(db, `rooms/${rId}/players/${playerIdRef.current}/metrics`), gameStateRef.current);
  };

  const getDemandLabel = (svc, rep) => {
    const priceRatio = svc.price / svc.basePrice;
    const tolerance = 1.0 + (rep / 100);
    const fairness = tolerance / priceRatio;

    if (fairness >= 1.2) return { text: "High 🔥", color: "text-emerald-400" };
    if (fairness >= 0.9) return { text: "Medium", color: "text-yellow-400" };
    return { text: "Low 📉", color: "text-red-400" };
  };

  // NEW: numeric fairness (for "unpalatable at current reputation" logic)
  const getFairness = (svc, rep) => {
    const priceRatio = svc.price / svc.basePrice;
    const tolerance = 1.0 + (rep / 100);
    return tolerance / priceRatio;
  };

  // NEW: if a price hike makes it unpalatable, customers in waiting room can leave quickly
  const applyPriceShockToWaitingRoom = (serviceKey, priceDelta) => {
    // Only apply "shock" on hikes
    if (priceDelta <= 0) return;

    const s = gameStateRef.current;
    const svc = s.services?.[serviceKey];
    if (!svc || !svc.unlocked) return;

    const fairness = getFairness(svc, s.reputation);

    // If still acceptable, do nothing
    if (fairness >= 0.9) return;

    // The worse the fairness, the higher the immediate leave chance
    const severity = Math.min(1, (0.9 - fairness) / 0.9); // 0..1
    const leaveChance = Math.max(0.15, Math.min(0.95, 0.35 + severity * 0.6));

    let leftCount = 0;

    // Iterate backwards so we can safely splice
    for (let i = s.customers.length - 1; i >= 0; i--) {
      const c = s.customers[i];
      if (c.service !== serviceKey) continue;
      if (Math.random() < leaveChance) {
        s.customers.splice(i, 1);
        leftCount++;
      }
    }

    if (leftCount > 0) {
      // Small but noticeable rep hit; capped
      const repHit = Math.min(6, Math.max(1, Math.ceil(leftCount / 2)));
      s.reputation = Math.max(0, s.reputation - repHit);
      notify(`${leftCount} customer${leftCount === 1 ? '' : 's'} left due to prices!`, "bad");
      logEvent("PRICE_SHOCK", `${leftCount} left after ${svc.name} price hike`, 0);
    }
  };

  // --- PLAYER SYNC & GAME LOOP ---
  useEffect(() => {
    if (view !== 'player') return;

    const statusRef = ref(db, `rooms/${roomId}/status`);
    const unsubStatus = onValue(statusRef, (snap) => {
      const s = snap.val();
      setRoomStatus(s);
      if (s === 'ended') {
        setAiModal({ open: true, content: "The Host has ended the game. Check the main screen for analysis!", loading: false });
      }
    });

    const loop = setInterval(() => {
      if (roomStatus === 'ended') return;

      const state = gameStateRef.current;
      let syncNeeded = false;

      // 1. Time
      state.time += 1;
      if (state.time >= 1080) {
        endDay(state);
        syncNeeded = true;
      }

      // 2. DEMAND & SPAWNING
      if (state.time < 1020) {
        let baseChance = 0.01 + (state.reputation * 0.002);

        // Price Tolerance Logic
        const tolerance = 1.0 + (state.reputation / 100);
        let sentimentMultiplier = 1.0;

        Object.values(state.services).forEach(svc => {
          if (svc.unlocked) {
            const priceRatio = svc.price / svc.basePrice;
            const fairness = tolerance / priceRatio;
            if (fairness < 1) sentimentMultiplier *= fairness;
            else sentimentMultiplier *= 1.05;
          }
        });

        sentimentMultiplier = Math.max(0.1, Math.min(2.0, sentimentMultiplier));
        const finalChance = baseChance * sentimentMultiplier;

        if (Math.random() < Math.max(0.001, finalChance) && state.customers.length < 8) {
          const roll = Math.random();
          let srv = 'cut';
          if (state.services.style.unlocked && roll > 0.8) srv = 'style';
          else if (state.services.color.unlocked && roll > 0.6) srv = 'color';
          state.customers.push({ id: Math.random(), patience: 100, service: srv });
        }
      }

      // 3. Staff Logic
      state.staff.forEach(staff => {
        // keep stats in range
        staff.skill = clampStat(staff.skill);
        staff.speed = clampStat(staff.speed);

        if (staff.state === 'WORKING') {
          staff.currentTask.progress += (0.8 + (staff.speed * 0.15));
          if (staff.currentTask.progress >= staff.currentTask.totalTime) {
            const service = state.services[staff.currentTask.serviceId];

            // IMPORTANT: use the price agreed when the customer sat in the chair (locks-in price for current cut)
            const chargedPrice = staff.currentTask.agreedPrice ?? service.price;

            state.money += chargedPrice;
            state.reputation += (staff.skill / 5);
            staff.energy -= 10;
            staff.state = 'IDLE';
            staff.currentTask = null;
            showFloatingText(staff.id, `+$${chargedPrice}`, 'money');
            syncNeeded = true;
          }
        } else if (staff.state === 'IDLE') {
          if (staff.energy < 100) staff.energy += 0.05;

          if (state.customers.length > 0 && staff.energy > 20) {
            const cust = state.customers.shift();
            staff.state = 'WORKING';

            let time = 100;
            if (cust.service === 'color') time = 300;
            if (cust.service === 'style') time = 200;

            // IMPORTANT: lock in service + price at the moment the customer sits in the chair
            const svc = state.services[cust.service];
            staff.currentTask = {
              serviceId: cust.service,
              progress: 0,
              totalTime: time,
              agreedPrice: svc?.price ?? 0
            };
          } else if (staff.energy < 20) staff.state = 'RESTING';
        } else if (staff.state === 'RESTING') {
          staff.energy += 0.5;
          if (staff.energy >= 100) staff.state = 'IDLE';
        } else if (staff.state === 'TRAINING') {
          staff.currentTask.progress++;
          if (staff.currentTask.progress >= staff.currentTask.totalTime) {
            staff.skill = clampStat(staff.skill + 1);
            staff.speed = clampStat(staff.speed + 1);
            staff.state = 'IDLE';
            staff.currentTask = null;
            notify(`${staff.name} finished training!`, 'good');
            syncNeeded = true;
          }
        }
      });

      // 4. Patience
      for (let i = state.customers.length - 1; i >= 0; i--) {
        state.customers[i].patience -= 0.1;
        if (state.customers[i].patience <= 0) {
          state.customers.splice(i, 1);
          state.reputation = Math.max(0, state.reputation - 2);
          notify("Customer left angry!", "bad");
          syncNeeded = true;
        }
      }

      setTick(t => t + 1);
      if (syncNeeded || state.time % 20 === 0) {
        update(ref(db, `rooms/${roomId}/players/${playerIdRef.current}/metrics`), state);
      }
    }, 100);

    return () => {
      clearInterval(loop);
      unsubStatus();
    };
  }, [view, roomId, roomStatus]);

  // --- CONTROLS ---
  const actions = {
    hire: () => {
      if (roomStatus === 'ended') return;
      const s = gameStateRef.current;
      if (s.money >= 200) {
        if (s.staff.length >= s.stations) return notify("Not enough stations!", "bad");
        s.money -= 200;
        s.staff.push({
          id: Date.now(),
          name: NAMES[Math.floor(Math.random() * NAMES.length)],
          skill: clampStat(3),
          speed: clampStat(3),
          energy: 100,
          state: 'IDLE',
          currentTask: null
        });
        notify("Hired Stylist!", "good");
        logEvent("HIRE_STAFF", "Hired Stylist", -200);
      } else notify("Need $200", "bad");
    },

    buyStation: () => {
      if (roomStatus === 'ended') return;
      const s = gameStateRef.current;
      if (s.money >= 800 && s.stations < s.maxStations) {
        s.money -= 800; s.stations++;
        notify("New Station!", "good");
        logEvent("BUILD", "New Station", -800);
      } else notify("Need $800", "bad");
    },

    adjustPrice: (key, amount) => {
      if (roomStatus === 'ended') return;
      const svc = gameStateRef.current.services[key];
      if (!svc) return;

      const oldPrice = svc.price;

      if (svc.price + amount >= 5) svc.price += amount;

      const newPrice = svc.price;
      const delta = newPrice - oldPrice;

      // NEW: if hike makes it unpalatable, waiting customers can rapidly leave
      // (does NOT affect anyone already in the chair, because we lock in agreedPrice at chair-time)
      if (delta > 0) {
        applyPriceShockToWaitingRoom(key, delta);
      }
    },

    unlockService: (key) => {
      if (roomStatus === 'ended') return;
      const s = gameStateRef.current;
      const rule = SERVICE_UNLOCKS[key];
      const svc = s.services[key];
      if (!rule || !svc) return;

      if (svc.unlocked) return notify("Service already unlocked.", "neutral");

      const highestSkill = getHighestSkill(s);
      if (highestSkill < rule.reqSkill) {
        return notify(`Need staff skill ${rule.reqSkill}+ to unlock ${rule.label}.`, "bad");
      }
      if (s.money < rule.cost) {
        return notify(`Need $${rule.cost} to unlock ${rule.label}.`, "bad");
      }

      s.money -= rule.cost;
      svc.unlocked = true;
      notify(`Unlocked: ${rule.label}!`, "good");
      logEvent("UNLOCK_SERVICE", `Unlocked ${rule.label}`, -rule.cost);
      update(ref(db, `rooms/${roomId}/players/${playerIdRef.current}/metrics`), s);
    },

    train: (id) => {
      if (roomStatus === 'ended') return;
      const s = gameStateRef.current;
      const staff = s.staff.find(st => st.id === id);
      if (staff && staff.state === 'IDLE' && s.money >= 150) {
        s.money -= 150;
        staff.state = 'TRAINING';
        staff.currentTask = { progress: 0, totalTime: 300 };
        logEvent("TRAIN", `Trained ${staff.name}`, -150);
      } else if (s.money < 150) {
        notify("Need $150", "bad");
      }
    },

    market: async (type) => {
      if (roomStatus === 'ended') return;
      const s = gameStateRef.current;
      const cost = type === 'social' ? 150 : 400;
      const rep = type === 'social' ? 5 : 15;
      if (s.money >= cost) {
        s.money -= cost; s.reputation += rep;
        logEvent("MARKETING", `Ran ${type}`, -cost);
        notify(`${type} Campaign!`, "good");
        setAiModal({ open: true, loading: true, content: 'Generating ad copy...' });
        const adCopy = await callGemini(`Write a 1-sentence ${type} ad for a salon called Luxe & Co. Use emojis.`);
        setAiModal({ open: true, loading: false, content: adCopy });
      } else {
        notify(`Need $${cost}`, "bad");
      }
    }
  };

  const handleCoach = async () => {
    if (roomStatus === 'ended') return;
    setAiModal({ open: true, loading: true, content: '' });
    const s = gameStateRef.current;
    const prompt = `Act as a savvy business coach. Analyze: Money $${Math.floor(s.money)}, Rep ${Math.floor(s.reputation)}, Staff ${s.staff.length}. Give 1 short, actionable tip.`;
    const advice = await callGemini(prompt);
    setAiModal({ open: true, loading: false, content: advice });
  };

  const formatTime = (min) => `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;

  // --- VIEW: LOBBY ---
  if (view === 'lobby') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 font-sans text-zinc-100 overflow-y-auto">
        <style>{styles}</style>
        <div className="w-full max-w-md bg-[#0a0a0a] border border-[#222] rounded-[30px] p-8 shadow-2xl my-4">
          <h1 className="text-6xl italic text-pink-500 mb-2 font-serif text-center">Luxe & Co.</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-bold text-center mb-10">Business Simulator</p>
          <div className="space-y-6">
            <input value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="ROOM CODE" className="w-full bg-[#1a1a1a] border border-[#333] text-white p-4 rounded-xl font-mono uppercase focus:border-pink-500 outline-none" />
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="YOUR NAME" className="w-full bg-[#1a1a1a] border border-[#333] text-white p-4 rounded-xl outline-none focus:border-pink-500" />
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button onClick={handleCreateHost} className="flex items-center justify-center gap-2 py-4 bg-[#1a1a1a] border border-[#333] rounded-xl hover:bg-[#222] min-h-[56px]"><Monitor size={20} /> HOST</button>
              <button onClick={handleJoinGame} className="flex items-center justify-center gap-2 py-4 bg-pink-600 rounded-xl hover:bg-pink-500 font-bold min-h-[56px]"><Play size={20} /> JOIN</button>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-[#222]">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-4 text-center">Active Rooms</p>
            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
              {Object.entries(activeRooms).map(([k, v]) => (
                <div key={k} onClick={() => setRoomId(k)} className="cursor-pointer bg-[#111] p-3 rounded-lg flex justify-between hover:border-pink-500 border border-transparent">
                  <span className="text-pink-500 font-mono text-sm">{k}</span>
                  <span className="text-[10px] text-zinc-500">{v.status === 'ended' ? 'ENDED' : 'LIVE'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: HOST DASHBOARD ---
  if (view === 'host') {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-6 flex flex-col font-sans overflow-x-hidden">
        <style>{styles}</style>
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-zinc-800 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl italic text-pink-500 font-serif">
              Host Dashboard: <span className="text-white font-mono not-italic">{roomId}</span>
            </h1>

            {/* REFRESH RATE TOGGLE + COUNTDOWN */}
            <button
              onClick={() => setRefreshMode(prev => prev === 'live' ? '5s' : 'live')}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                refreshMode === 'live'
                  ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                  : 'bg-zinc-800 text-zinc-200 border-zinc-700'
              }`}
              title={refreshMode === 'live' ? 'Currently live updates' : 'Polling every 5 seconds'}
            >
              <RefreshCw size={12} className={refreshMode === 'live' ? 'animate-spin-slow' : ''} />
              {refreshMode === 'live'
                ? 'Live'
                : `5s Poll · ${pollCountdown}s`}
            </button>
          </div>

          {roomStatus === 'active' ? (
            <button onClick={triggerEndGame} className="w-full md:w-auto px-6 py-3 bg-red-900/20 border border-red-700 text-red-200 rounded-lg hover:bg-red-900/40 font-bold flex items-center justify-center gap-2">
              <Activity size={18} /> End Game & Analyze
            </button>
          ) : (
            <div className="px-6 py-3 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg">Game Ended</div>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(hostPlayersData).map(([pid, pData]) => {
            const m = pData.metrics || {};
            const profit = (m.money || 0) - 650;
            return (
              <div key={pid} className="glass-panel p-6 rounded-2xl border-t-4 border-t-pink-500 flex flex-col gap-4">
                <div className="flex justify-between"><h3 className="text-xl font-bold truncate">{pData.name}</h3></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 p-2 rounded">
                    <p className="text-xs text-zinc-500">Profit</p>
                    <p className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${profit}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-2 rounded">
                    <p className="text-xs text-zinc-500">Rep</p>
                    <p className="text-xl font-bold text-pink-400">{Math.floor(m.reputation || 0)}</p>
                  </div>
                </div>
                <div className="text-sm text-zinc-400 flex justify-between border-t border-zinc-800 pt-2">
                  <span>Staff: {m.staff?.length || 0}</span>
                  <span>Status: {roomStatus === 'active' ? 'Live' : 'Done'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* CUSTOM CONFIRMATION MODAL */}
        {confirmModal.open && (
          <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
            <div className="glass-panel p-6 rounded-2xl max-w-sm w-full border border-red-900">
              <div className="flex items-center gap-2 mb-4 text-red-400">
                <AlertTriangle />
                <h3 className="text-xl font-bold">{confirmModal.title}</h3>
              </div>
              <p className="text-zinc-300 mb-6">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button onClick={() => setConfirmModal({ open: false })} className="flex-1 py-3 bg-zinc-800 rounded-xl hover:bg-zinc-700">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-red-600 rounded-xl hover:bg-red-500 font-bold">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {showAnalysis && (
          <div className="fixed inset-0 bg-black/95 z-[100] overflow-y-auto p-4 md:p-6">
            <div className="max-w-6xl mx-auto pb-20">
              <div className="flex justify-between items-center mb-8 sticky top-0 bg-black/95 py-4 border-b border-zinc-800 z-10">
                <h2 className="text-2xl md:text-3xl text-white font-bold flex items-center gap-2"><TrendingUp className="text-emerald-500" /> Strategy Analysis</h2>
                <button onClick={() => setShowAnalysis(false)} className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700">Close</button>
              </div>

              <div className="space-y-8">
                {Object.entries(hostPlayersData).map(([pid, pData]) => {
                  if (!pData.history) return null;
                  const events = Object.values(pData.history).sort((a, b) => a.timestamp - b.timestamp);
                  const width = 800; const height = 250; const padding = 40;
                  const startTime = events.length ? events[0].timestamp : Date.now();
                  const timeRange = Math.max(1, (events[events.length - 1]?.timestamp || Date.now()) - startTime);
                  const minMoney = Math.min(650, ...events.map(e => e.profitAtTime));
                  const maxMoney = Math.max(1000, ...events.map(e => e.profitAtTime));
                  const moneyRange = Math.max(100, maxMoney - minMoney);

                  const getX = (t) => padding + ((t - startTime) / timeRange) * (width - 2 * padding);
                  const getY = (m) => height - padding - ((m - minMoney) / moneyRange) * (height - 2 * padding);

                  let pathD = "";
                  events.forEach((e, i) => {
                    const x = getX(e.timestamp);
                    const y = getY(e.profitAtTime);
                    if (i === 0) pathD += `M ${x} ${y}`; else pathD += ` L ${x} ${y}`;
                  });

                  return (
                    <div key={pid} className="bg-[#121214] border border-[#27272a] p-4 md:p-6 rounded-2xl">
                      <div className="flex flex-col md:flex-row justify-between mb-4 gap-2">
                        <h3 className="text-xl font-bold text-white">{pData.name} <span className="text-zinc-500 text-sm font-normal">History</span></h3>
                        <div className="flex gap-4 text-xs">
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Hire</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-pink-500 transform rotate-45"></div> Marketing</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500"></div> Train</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-auto overflow-visible">
                          <line x1={padding} y1={getY(650)} x2={width - padding} y2={getY(650)} stroke="#52525b" strokeDasharray="4" opacity="0.5" />
                          <text x={padding} y={getY(650) - 5} fill="#52525b" fontSize="10">Start $650</text>
                          <path d={pathD} fill="none" stroke="#be185d" strokeWidth="2" />
                          {events.map((e, i) => {
                            const x = getX(e.timestamp);
                            const y = getY(e.profitAtTime);
                            let shape; let color;
                            if (e.type.includes('HIRE')) { color = "#10b981"; shape = <circle cx={x} cy={y} r="5" fill={color} className="graph-point cursor-pointer" />; }
                            else if (e.type.includes('TRAIN')) { color = "#3b82f6"; shape = <rect x={x - 4} y={y - 4} width="8" height="8" fill={color} className="graph-point cursor-pointer" />; }
                            else if (e.type.includes('MARKETING')) { color = "#ec4899"; shape = <polygon points={`${x},${y - 6} ${x + 5},${y + 4} ${x - 5},${y + 4}`} fill={color} className="graph-point cursor-pointer" />; }
                            else { shape = <circle cx={x} cy={y} r="3" fill="#fff" className="graph-point" />; }
                            return (
                              <g key={i}>
                                {shape}
                                <g className="graph-tooltip">
                                  <rect x={x - 60} y={y - 40} width="120" height="30" rx="5" fill="#000" stroke="#333" />
                                  <text x={x} y={y - 20} fill="white" fontSize="10" textAnchor="middle" alignmentBaseline="middle">{e.detail}</text>
                                </g>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VIEW: PLAYER GAME ---
  const state = gameStateRef.current;
  const highestSkill = getHighestSkill(state);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      <style>{styles}</style>

      {aiModal.open && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex gap-2 text-xl"><Sparkles className="text-yellow-400" /> Message</h3>
              <button onClick={() => setAiModal({ open: false })}><X /></button>
            </div>
            <p className="text-zinc-300 italic leading-relaxed">{aiModal.loading ? "Thinking..." : aiModal.content}</p>
          </div>
        </div>
      )}

      <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`glass-panel px-4 py-3 rounded-lg border-l-4 shadow-xl text-sm font-bold animate-in slide-in-from-right ${
              n.type === 'good' ? 'border-emerald-500 text-emerald-100'
                : n.type === 'bad' ? 'border-red-500 text-red-100'
                  : 'border-zinc-500'
            }`}
          >
            {n.msg}
          </div>
        ))}
      </div>

      <aside className="w-full md:w-1/4 bg-[#121214] border-t md:border-t-0 md:border-r border-[#27272a] flex flex-col h-1/3 md:h-full z-20 order-2 md:order-1">
        <div className="hidden md:block p-4 border-b border-[#27272a] text-center">
          <h2 className="text-2xl italic text-pink-500 font-serif">Management</h2>
        </div>

        <div className="flex border-b border-[#27272a] sticky top-0 bg-[#121214] z-10">
          {['services', 'staff', 'marketing'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider ${
                activeTab === t ? 'text-pink-500 bg-[#1a1a1a] border-b-2 border-pink-500' : 'text-zinc-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
          {activeTab === 'services' && Object.entries(state.services).map(([k, s]) => {
            const demand = getDemandLabel(s, state.reputation);
            const rule = SERVICE_UNLOCKS[k];

            const canUnlockBySkill = rule ? highestSkill >= rule.reqSkill : true;
            const canAffordUnlock = rule ? state.money >= rule.cost : true;
            const showUnlock = rule && !s.unlocked;

            return (
              <div key={k} className={`glass-panel p-4 rounded-xl flex flex-col gap-2 ${!s.unlocked && 'opacity-90'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white">{s.name}</div>
                    <div className={`text-xs font-bold ${demand.color}`}>Demand: {demand.text}</div>

                    {showUnlock && (
                      <div className="mt-2 text-[10px] text-zinc-300">
                        Unlock requirement: <span className="font-bold text-white">Staff skill {rule.reqSkill}+</span>
                        <span className="text-zinc-500"> · </span>
                        Cost: <span className="font-bold text-white">${rule.cost}</span>
                      </div>
                    )}
                    {!s.unlocked && !showUnlock && (
                      <div className="mt-2 text-[10px] text-zinc-400">Locked</div>
                    )}
                  </div>

                  <div className="text-sm font-mono">
                    {s.unlocked ? `$${s.price}` : <span className="text-zinc-500">—</span>}
                  </div>
                </div>

                <div className="flex gap-3 justify-end items-center">
                  {s.unlocked ? (
                    <>
                      <button onClick={() => actions.adjustPrice(k, -5)} className="bg-zinc-700 w-8 h-8 rounded-full text-lg touch-manipulation">-</button>
                      <button onClick={() => actions.adjustPrice(k, 5)} className="bg-zinc-700 w-8 h-8 rounded-full text-lg touch-manipulation">+</button>
                    </>
                  ) : (
                    rule ? (
                      <button
                        onClick={() => actions.unlockService(k)}
                        disabled={!canUnlockBySkill || !canAffordUnlock}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border touch-manipulation ${
                          (!canUnlockBySkill || !canAffordUnlock)
                            ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                            : 'bg-pink-600 text-white border-pink-400 hover:bg-pink-500'
                        }`}
                        title={
                          !canUnlockBySkill
                            ? `Need any staff at skill ${rule.reqSkill}+ (current best: ${highestSkill})`
                            : !canAffordUnlock
                              ? `Need $${rule.cost}`
                              : `Unlock ${rule.label}`
                        }
                      >
                        Unlock
                      </button>
                    ) : null
                  )}
                </div>
              </div>
            );
          })}

          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-zinc-800 p-3 rounded-xl">
                <span className="text-sm">Seats: {state.stations}/{state.maxStations}</span>
                <button onClick={actions.buyStation} className="text-xs bg-pink-600 px-3 py-2 rounded font-bold touch-manipulation">Buy ($800)</button>
              </div>

              <div className="glass-panel p-3 rounded-xl flex justify-between items-center">
                <div className="text-xs text-zinc-300">
                  Best staff skill: <span className="text-white font-bold">{highestSkill}</span>/10
                  <span className="text-zinc-500"> · </span>
                  Tier: <span className="text-white font-bold">{statLabel(highestSkill)}</span>
                </div>
              </div>

              <button onClick={actions.hire} className="w-full py-3 bg-emerald-900/50 border border-emerald-700 rounded-xl text-emerald-100 font-bold touch-manipulation">Hire Stylist ($200)</button>

              <div className="space-y-2">
                {state.staff.map(s => (
                  <div key={s.id} className="glass-panel p-3 rounded-lg flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {s.name}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                          {statLabel(s.skill)}
                        </span>
                      </div>

                      <div className="text-[10px] text-zinc-400 font-mono">{s.state}</div>

                      <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-300">
                        <span className="flex items-center gap-1">
                          <Scissors size={12} className="text-pink-400" />
                          Skill: <span className="font-bold text-white">{clampStat(s.skill)}</span>/10
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-emerald-400" />
                          Speed: <span className="font-bold text-white">{clampStat(s.speed)}</span>/10
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => actions.train(s.id)}
                      className="text-xs bg-blue-900/50 px-3 py-2 rounded text-blue-200 border border-blue-800 font-bold touch-manipulation shrink-0"
                      disabled={s.state !== 'IDLE'}
                      title={s.state !== 'IDLE' ? 'Must be IDLE to train' : 'Train (+1 skill, +1 speed)'}
                    >
                      Train
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="space-y-3">
              <button onClick={() => actions.market('social')} className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-left hover:bg-zinc-750 touch-manipulation">
                <div className="font-bold text-white">Social Ad</div>
                <div className="text-xs text-pink-400 font-bold mt-1">Cost: $150 | +5 Rep</div>
              </button>
              <button onClick={() => actions.market('radio')} className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-left hover:bg-zinc-750 touch-manipulation">
                <div className="font-bold text-white">Radio Spot</div>
                <div className="text-xs text-pink-400 font-bold mt-1">Cost: $400 | +15 Rep</div>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 bg-[#09090b] relative flex flex-col order-1 md:order-2 h-2/3 md:h-full">
        <div className="absolute top-0 w-full z-10 p-2 md:p-4 pointer-events-none">
          <div className="flex justify-between items-start">
            <div className="flex gap-2 pointer-events-auto">
              <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-xl border border-zinc-700 text-emerald-400 font-bold flex items-center gap-2 shadow-lg">
                <span>$</span>{Math.floor(state.money)}
              </div>
              <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-xl border border-zinc-700 text-pink-400 font-bold flex items-center gap-2 shadow-lg">
                <Star size={16} />{Math.floor(state.reputation)}
              </div>
            </div>

            <div className="flex gap-2 pointer-events-auto">
              <button onClick={handleCoach} className="bg-indigo-600/90 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-1 text-xs font-bold border border-indigo-400">
                <Sparkles size={14} /> Coach
              </button>

              <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-xl border border-zinc-700 text-white font-bold flex items-center gap-2 text-sm shadow-lg">
                <Calendar size={16} /> Day {state.day}
              </div>

              <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-xl border border-zinc-700 text-white font-mono flex items-center gap-2 text-sm shadow-lg">
                <Clock size={16} />{formatTime(state.time)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          <div className="w-full max-w-2xl z-0 mt-8 md:mt-0">
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {Array.from({ length: state.stations }).map((_, i) => {
                const staff = state.staff[i];
                return (
                  <div key={i} className={`aspect-square relative rounded-2xl border flex flex-col items-center justify-center transition-all ${staff ? 'bg-zinc-800/80 border-zinc-600' : 'border-dashed border-zinc-700 opacity-30'}`}>
                    {staff ? (
                      <>
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center bg-zinc-700 relative ${staff.state === 'WORKING' ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : staff.state === 'TRAINING' ? 'border-blue-500' : 'border-zinc-500'}`}>
                          <User size={24} className="text-zinc-300 md:w-8 md:h-8" />
                          {floatingTexts.filter(t => t.staffId === staff.id).map(t => (
                            <div key={t.id} className="absolute -top-8 text-emerald-400 font-bold animate-float whitespace-nowrap text-sm shadow-black drop-shadow-md">{t.text}</div>
                          ))}
                        </div>

                        <div className="mt-2 text-[10px] md:text-xs font-bold bg-black/50 px-2 rounded text-white truncate max-w-full">
                          {staff.name}
                        </div>

                        {/* Skill + Speed chips */}
                        <div className="mt-1 flex items-center justify-center gap-2 text-[9px] md:text-[10px] text-zinc-200">
                          <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-zinc-700">
                            <Scissors size={10} className="text-pink-400" />
                            {clampStat(staff.skill)}/10
                          </span>
                          <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-zinc-700">
                            <Clock size={10} className="text-emerald-400" />
                            {clampStat(staff.speed)}/10
                          </span>
                        </div>

                        {staff.currentTask && (
                          <div className="absolute bottom-2 w-3/4 h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${staff.state === 'WORKING' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${(staff.currentTask.progress / staff.currentTask.totalTime) * 100}%` }}
                            />
                          </div>
                        )}
                      </>
                    ) : <span className="text-[10px] md:text-xs text-zinc-500">Empty</span>}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur p-3 rounded-xl border border-zinc-700 shadow-lg">
            <div className="text-[10px] text-zinc-400 uppercase mb-1 font-bold">Waiting Room</div>
            <div className="flex gap-1.5 min-h-[10px]">
              {state.customers.map(c => <div key={c.id} className={`w-2.5 h-2.5 rounded-full ${c.patience < 30 ? 'bg-red-500 animate-pulse' : 'bg-white'}`}></div>)}
              {state.customers.length === 0 && <span className="text-zinc-600 text-[10px] italic">Empty</span>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}