<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RopeScore Pro - Wedstrijdbeheer</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lucide-react/0.263.1/umd/lucide-react.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@700&display=swap');

        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --secondary: #7c3aed;
            --bg-main: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --accent-green: #10b981;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-main);
            color: var(--text-main);
            margin: 0;
            overflow: hidden;
        }

        .glass-panel {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .neo-card {
            background: var(--card-bg);
            border-radius: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .neo-card:hover {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
            transform: translateY(-2px);
        }

        .sidebar-item {
            cursor: pointer;
            transition: all 0.2s ease;
            border-left: 4px solid transparent;
        }

        .sidebar-item.active {
            background: #eff6ff;
            border-left-color: var(--primary);
        }

        .status-badge {
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 0.7rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .status-planned { background: #dbeafe; color: #1e40af; }
        .status-active { background: #dcfce7; color: #166534; animation: pulse 2s infinite; }
        .status-closed { background: #f1f5f9; color: #475569; }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        .btn-primary {
            background: var(--primary);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 800;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
        }

        .input-field {
            background: #f1f5f9;
            border: 2px solid transparent;
            border-radius: 12px;
            padding: 12px;
            font-size: 0.95rem;
            transition: all 0.2s;
        }

        .input-field:focus {
            background: white;
            border-color: var(--primary);
            outline: none;
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .big-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 6rem;
            line-height: 1;
            letter-spacing: -0.05em;
        }

        .tab-btn {
            position: relative;
            padding: 12px 24px;
            font-weight: 800;
            color: var(--text-muted);
            transition: all 0.2s;
        }

        .tab-btn.active {
            color: var(--primary);
        }

        .tab-btn.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 4px;
            background: var(--primary);
            border-radius: 2px;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

        .import-area {
            min-height: 200px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
        }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="module">
        import React, { useState, useEffect, useMemo } from 'https://esm.sh/react@18.2.0';
        import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
        import { 
            getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, addDoc, deleteDoc, query 
        } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';
        import { 
            getAuth, signInAnonymously, onAuthStateChanged 
        } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

        const firebaseConfig = {
            apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
            authDomain: "ropeskippingcontest.firebaseapp.com",
            projectId: "ropeskippingcontest",
            storageBucket: "ropeskippingcontest.firebasestorage.app",
            messagingSenderId: "430066523717",
            appId: "1:430066523717:web:eea53ced41773af66a4d2c",
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        const appId = 'ropescore-pro-ultimate';

        const App = () => {
            const [view, setView] = useState('management');
            const [activeTab, setActiveTab] = useState('speed');
            const [competitions, setCompetitions] = useState([]);
            const [activeCompId, setActiveCompId] = useState(null);
            const [skippers, setSkippers] = useState({});
            const [heats, setHeats] = useState([]);
            const [compSettings, setCompSettings] = useState({ currentSpeedHeat: 1, currentFreestyleHeat: 1 });
            const [csvInput, setCsvInput] = useState('');
            const [importType, setImportType] = useState('speed');
            const [newComp, setNewComp] = useState({ name: '', date: '', location: '', status: 'gepland' });
            const [user, setUser] = useState(null);

            useEffect(() => {
                signInAnonymously(auth);
                onAuthStateChanged(auth, setUser);
            }, []);

            // Luister naar wedstrijden
            useEffect(() => {
                if (!user) return;
                const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'));
                return onSnapshot(q, (snapshot) => {
                    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setCompetitions(list);
                    if (!activeCompId && list.length > 0) {
                        const active = list.find(c => c.status === 'actief') || list[0];
                        setActiveCompId(active.id);
                    }
                });
            }, [user]);

            // Luister naar data van actieve wedstrijd
            useEffect(() => {
                if (!activeCompId || !user) return;
                const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
                const skRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'skippers');
                const hRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats');

                const unsubS = onSnapshot(compRef, d => d.exists() && setCompSettings(d.data()));
                const unsubSk = onSnapshot(skRef, s => {
                    const d = {}; s.forEach(doc => d[doc.id] = doc.data());
                    setSkippers(d);
                });
                const unsubH = onSnapshot(hRef, s => setHeats(s.docs.map(d => ({ id: d.id, ...d.data() }))));

                return () => { unsubS(); unsubSk(); unsubH(); };
            }, [activeCompId, user]);

            const selectedComp = competitions.find(c => c.id === activeCompId);
            const stats = useMemo(() => ({
                speed: heats.filter(h => h.type === 'speed').length,
                freestyle: heats.filter(h => h.type === 'freestyle').length
            }), [heats]);

            const currentHeat = useMemo(() => {
                const num = activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1);
                return heats.find(h => h.type === activeTab && h.reeks === num);
            }, [heats, activeTab, compSettings]);

            const handleCreateComp = async (e) => {
                e.preventDefault();
                const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
                    ...newComp, currentSpeedHeat: 1, currentFreestyleHeat: 1
                });
                setNewComp({ name: '', date: '', location: '', status: 'gepland' });
                setActiveCompId(docRef.id);
            };

            const handleImport = async () => {
                if (!csvInput || !activeCompId) return;
                const batch = writeBatch(db);
                const lines = csvInput.split('\n').filter(l => l.trim());
                const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));

                rows.forEach(row => {
                    const reeksNum = parseInt(row[0]);
                    const baseRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
                    if (importType === 'speed') {
                        const slots = [];
                        for (let v = 1; v <= 10; v++) {
                            const club = row[3 + (v - 1) * 2], naam = row[4 + (v - 1) * 2];
                            if (naam) {
                                const sid = `s_${naam}_${club}`.replace(/\s/g, '_');
                                batch.set(doc(baseRef, 'skippers', sid), { id: sid, naam, club });
                                slots.push({ veldNr: v, skipperId: sid });
                            }
                        }
                        batch.set(doc(baseRef, 'heats', `s_${reeksNum}`), { type: 'speed', reeks: reeksNum, onderdeel: row[1], uur: row[2], slots });
                    } else {
                        const sid = `s_${row[2]}_${row[1]}`.replace(/\s/g, '_');
                        batch.set(doc(baseRef, 'skippers', sid), { id: sid, naam: row[2], club: row[1] });
                        batch.set(doc(baseRef, 'heats', `f_${reeksNum}`), { type: 'freestyle', reeks: reeksNum, onderdeel: 'Freestyle', uur: row[4], slots: [{ veld: row[3], skipperId: sid }] });
                    }
                });
                await batch.commit();
                setCsvInput('');
                alert('Import voltooid!');
            };

            const updateHeat = async (delta) => {
                const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), {
                    [key]: Math.max(1, (compSettings[key] || 1) + delta)
                });
            };

            return (
                <div className="flex flex-col h-screen">
                    {/* Header */}
                    <header className="glass-panel sticky top-0 z-50 px-8 py-4 flex justify-between items-center border-b">
                        <div className="flex items-center gap-10">
                            <div className="text-2xl font-black tracking-tighter">ROPESCORE <span className="text-blue-600">PRO</span></div>
                            <nav className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                                {['management', 'live', 'display'].map(v => (
                                    <button key={v} onClick={() => setView(v)} className={`px-5 py-2 rounded-lg text-sm font-bold transition ${view === v ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                                        {v.toUpperCase()}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        {selectedComp && (
                            <div className="flex items-center gap-3">
                                <div className={`status-badge status-${selectedComp.status}`}>{selectedComp.status}</div>
                                <div className="font-bold text-slate-800">{selectedComp.name}</div>
                            </div>
                        )}
                    </header>

                    <main className="flex-1 overflow-hidden p-8">
                        {view === 'management' && (
                            <div className="max-w-7xl mx-auto h-full grid grid-cols-12 gap-8">
                                {/* Sidebar: Wedstrijdlijst */}
                                <div className="col-span-4 flex flex-col gap-6 overflow-hidden">
                                    <div className="neo-card p-6 shrink-0">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Nieuwe Wedstrijd</h3>
                                        <form onSubmit={handleCreateComp} className="space-y-3">
                                            <input required placeholder="Wedstrijdnaam" className="input-field w-full" value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder="Locatie" className="input-field" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} />
                                                <input type="date" className="input-field text-xs" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
                                            </div>
                                            <button className="btn-primary w-full justify-center">AANMAKEN</button>
                                        </form>
                                    </div>
                                    <div className="neo-card p-0 flex-1 flex flex-col overflow-hidden">
                                        <div className="p-6 border-b"><h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Alle Wedstrijden</h3></div>
                                        <div className="flex-1 overflow-y-auto">
                                            {competitions.map(c => (
                                                <div key={c.id} onClick={() => setActiveCompId(c.id)} className={`sidebar-item p-6 border-b last:border-0 ${activeCompId === c.id ? 'active' : 'hover:bg-slate-50'}`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-lg">{c.name}</span>
                                                        <span className={`status-badge status-${c.status}`}>{c.status}</span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-bold">{c.location} • {c.date}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Management Area */}
                                <div className="col-span-8 flex flex-col gap-8 overflow-hidden">
                                    {selectedComp ? (
                                        <>
                                            <div className="grid grid-cols-3 gap-6">
                                                <div className="neo-card p-6 bg-blue-600 text-white border-0">
                                                    <div className="text-xs font-black opacity-60 uppercase mb-1">Status Wijzigen</div>
                                                    <div className="flex gap-2 mt-2">
                                                        {['gepland', 'actief', 'afgesloten'].map(s => (
                                                            <button key={s} onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), {status: s})} 
                                                                className={`px-2 py-1 rounded text-[10px] font-black uppercase border transition ${selectedComp.status === s ? 'bg-white text-blue-600' : 'border-white/20 hover:bg-white/10'}`}>
                                                                {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="neo-card p-6">
                                                    <div className="text-xs font-black text-slate-400 uppercase mb-1">Speed Reeksen</div>
                                                    <div className="text-4xl font-black text-blue-600 tabular-nums">{stats.speed}</div>
                                                </div>
                                                <div className="neo-card p-6">
                                                    <div className="text-xs font-black text-slate-400 uppercase mb-1">Freestyle Reeksen</div>
                                                    <div className="text-4xl font-black text-purple-600 tabular-nums">{stats.freestyle}</div>
                                                </div>
                                            </div>

                                            <div className="neo-card p-8 flex-1 flex flex-col overflow-hidden">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h2 className="text-xl font-black">Data Import</h2>
                                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                                        <button onClick={() => setImportType('speed')} className={`px-4 py-2 rounded-lg text-xs font-black transition ${importType === 'speed' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>SPEED</button>
                                                        <button onClick={() => setImportType('freestyle')} className={`px-4 py-2 rounded-lg text-xs font-black transition ${importType === 'freestyle' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>FREESTYLE</button>
                                                    </div>
                                                </div>
                                                <textarea value={csvInput} onChange={e => setCsvInput(e.target.value)} placeholder={`Plak ${importType} CSV data hier... (incl. header)`} className="flex-1 input-field import-area focus:bg-slate-50 mb-4" />
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-slate-400 font-medium">De eerste regel wordt als header beschouwd en overgeslagen.</p>
                                                    <button onClick={handleImport} className="btn-primary">GEGEVENS IMPORTEREN</button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center neo-card border-dashed">
                                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4 text-4xl">?</div>
                                            <p className="font-black text-slate-400">Selecteer een wedstrijd om te beheren</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {view === 'live' && selectedComp && (
                            <div className="max-w-4xl mx-auto h-full flex flex-col gap-8">
                                <div className="flex justify-center border-b">
                                    <button onClick={() => setActiveTab('speed')} className={`tab-btn ${activeTab === 'speed' ? 'active' : ''}`}>SPEED</button>
                                    <button onClick={() => setActiveTab('freestyle')} className={`tab-btn ${activeTab === 'freestyle' ? 'active' : ''}`}>FREESTYLE</button>
                                </div>

                                <div className="neo-card p-10 text-center flex flex-col items-center">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Huidige Reeks</span>
                                    <div className="flex items-center gap-12">
                                        <button onClick={() => updateHeat(-1)} className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition text-2xl">←</button>
                                        <span className="big-number text-blue-600">{activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)}</span>
                                        <button onClick={() => updateHeat(1)} className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition text-2xl">→</button>
                                    </div>
                                    <div className="mt-8">
                                        <div className="text-2xl font-black">{currentHeat?.onderdeel || 'Geen reeks gevonden'}</div>
                                        <div className="text-slate-400 font-bold mt-1">{currentHeat?.uur || '--:--'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 overflow-y-auto pb-10">
                                    {activeTab === 'speed' ? (
                                        Array.from({length: 10}).map((_, i) => {
                                            const vNum = i + 1;
                                            const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                                            const sk = slot ? skippers[slot.skipperId] : null;
                                            return (
                                                <div key={vNum} className={`neo-card p-5 flex items-center gap-6 ${!sk ? 'opacity-30 border-dashed' : ''}`}>
                                                    <div className="w-20 font-black text-blue-600 text-sm">VELD {vNum}</div>
                                                    <div className="flex-1 font-extrabold text-xl">{sk?.naam || '-'}</div>
                                                    <div className="text-slate-400 font-black text-xs uppercase">{sk?.club || ''}</div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        currentHeat?.slots?.map((slot, i) => (
                                            <div key={i} className="neo-card p-8 flex items-center gap-8">
                                                <div className="w-24 font-black text-purple-600 text-lg">{slot.veld}</div>
                                                <div className="flex-1 font-black text-3xl">{skippers[slot.skipperId]?.naam}</div>
                                                <div className="text-slate-400 font-black text-lg uppercase">{skippers[slot.skipperId]?.club}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {view === 'display' && (
                            <div className="fixed inset-0 bg-white z-[100] flex flex-col p-12 overflow-hidden">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h1 className="text-7xl font-black tracking-tighter leading-none mb-4">{currentHeat?.onderdeel?.toUpperCase() || 'WACHTEN...'}</h1>
                                        <div className="text-blue-600 font-black text-2xl">LIVE WEDSTRIJD OVERZICHT • {selectedComp?.name}</div>
                                    </div>
                                    <div className="flex gap-6">
                                        <div className="neo-card p-6 bg-slate-50 border-0 text-right">
                                            <div className="text-sm font-black text-slate-400 uppercase mb-1">Gepland</div>
                                            <div className="text-4xl font-black">{currentHeat?.uur || '--:--'}</div>
                                        </div>
                                        <div className="neo-card p-6 bg-black text-white border-0 text-right">
                                            <div className="text-sm font-black opacity-40 uppercase mb-1">Reeks</div>
                                            <div className="text-4xl font-black tabular-nums">{activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-1 gap-2 overflow-hidden">
                                    {activeTab === 'speed' ? (
                                        Array.from({length: 10}).map((_, i) => {
                                            const vNum = i + 1;
                                            const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                                            const sk = slot ? skippers[slot.skipperId] : null;
                                            return (
                                                <div key={vNum} className={`flex-1 flex items-center px-12 border-2 rounded-[2rem] ${sk ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-transparent opacity-10'}`}>
                                                    <span className="w-32 text-xl font-black text-blue-600 italic">VELD {vNum}</span>
                                                    <span className="flex-1 text-4xl font-black">{sk?.naam || ''}</span>
                                                    <span className="text-2xl font-bold text-slate-300 uppercase">{sk?.club || ''}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        currentHeat?.slots?.map((slot, i) => (
                                            <div key={i} className="flex-1 flex items-center px-16 bg-white border-4 border-slate-100 rounded-[3rem]">
                                                <span className="w-40 text-3xl font-black text-purple-600">{slot.veld}</span>
                                                <span className="flex-1 text-7xl font-black">{skippers[slot.skipperId]?.naam}</span>
                                                <span className="text-4xl font-bold text-slate-300 uppercase">{skippers[slot.skipperId]?.club}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <button onClick={() => setView('live')} className="absolute bottom-4 left-4 opacity-5 hover:opacity-100 text-[10px] font-black uppercase tracking-widest">Terug naar beheer</button>
                            </div>
                        )}
                    </main>
                </div>
            );
        };

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>
