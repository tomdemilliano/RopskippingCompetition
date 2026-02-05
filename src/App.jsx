import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, addDoc, query 
} from 'firebase/firestore';
import { 
    getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
    Layout, Users, Play, Monitor, Plus, Calendar, MapPin, ChevronLeft, ChevronRight, 
    Upload, Trash2, Edit3, X, Search, Trophy, Settings, ArrowLeft, UserMinus, 
    SkipForward, SkipBack, RefreshCw, Volume2, CheckCircle2, Circle, Save
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATIE & INITIALISATIE
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBdlKc-a_4Xt9MY_2Tjcf" + "KXT7bqJsDr8yY", 
    authDomain: "ropeskippingcontest.firebaseapp.com",
    projectId: "ropeskippingcontest",
    storageBucket: "ropeskippingcontest.firebasestorage.app",
    messagingSenderId: "430066523717",
    appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-ultimate';

// ==========================================
// 2. STYLES & THEME
// ==========================================

const UI_STYLES = {
    card: { background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' },
    btn: (bg = '#2563eb', color = 'white') => ({ 
        background: bg, color, padding: '10px 20px', borderRadius: '10px', 
        border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', 
        alignItems: 'center', gap: '8px', transition: 'all 0.2s' 
    }),
    tab: (active) => ({ 
        padding: '12px 24px', cursor: 'pointer', background: 'none',
        border: 'none', borderBottom: active ? '3px solid #2563eb' : '3px solid transparent', 
        color: active ? '#2563eb' : '#64748b', fontWeight: 700, fontSize: '14px' 
    }),
    badge: (color) => ({ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: color + '15', color: color }),
};

// ==========================================
// 3. HOOFD COMPONENT
// ==========================================

export default function App() {
    // --- STATE: NAVIGATIE ---
    const [view, setView] = useState('management'); 
    const [mgmtTab, setMgmtTab] = useState('overview'); 
    const [activeTab, setActiveTab] = useState('freestyle');
    
    // --- STATE: DATA ---
    const [user, setUser] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [activeCompId, setActiveCompId] = useState(null);
    const [skippers, setSkippers] = useState({});
    const [heats, setHeats] = useState([]);
    const [compSettings, setCompSettings] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);

    // --- EFFECT: AUTH ---
    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    // --- EFFECT: DATA FETCHING ---
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'));
        return onSnapshot(q, (s) => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [user]);

    useEffect(() => {
        if (!activeCompId || !user) return;
        const base = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
        const unsubS = onSnapshot(base, d => d.exists() && setCompSettings(d.data()));
        const unsubSk = onSnapshot(collection(base, 'skippers'), s => {
            const d = {}; s.forEach(doc => d[doc.id] = doc.data());
            setSkippers(d);
        });
        const unsubH = onSnapshot(collection(base, 'heats'), s => setHeats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubS(); unsubSk(); unsubH(); };
    }, [activeCompId, user]);

    // --- LOGICA: DERIVED STATE ---
    const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed').sort((a,b) => a.reeks - b.reeks), [heats]);
    const freestyleHeats = useMemo(() => heats.filter(h => h.type === 'freestyle').sort((a,b) => a.reeks - b.reeks), [heats]);
    const currentHeatData = useMemo(() => {
        const heatList = activeTab === 'speed' ? speedHeats : freestyleHeats;
        const currentNr = activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1);
        return heatList.find(h => h.reeks === currentNr);
    }, [speedHeats, freestyleHeats, activeTab, compSettings]);

    // --- LOGICA: ACTIONS ---
    const handleCreateCompetition = async (formData) => {
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
            ...formData,
            currentSpeedHeat: 1,
            currentFreestyleHeat: 1,
            createdAt: new Date().toISOString()
        });
        setActiveCompId(docRef.id);
        setShowCreateModal(false);
    };

    const updateCurrentHeat = async (type, delta) => {
        const field = type === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
        const newVal = Math.max(1, (compSettings[field] || 1) + delta);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), { [field]: newVal });
    };

    // ==========================================
    // 4. SUB-RENDERER: MANAGEMENT
    // ==========================================
    const renderManagement = () => {
        if (!activeCompId) {
            return (
                <div className="max-w-6xl mx-auto py-12 text-center">
                    <h1 className="text-4xl font-black mb-4">RopeScore Pro</h1>
                    <p className="text-slate-500 mb-12">Beheer je wedstrijden, deelnemers en reeksen op één plek.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div onClick={() => setShowCreateModal(true)} style={{ ...UI_STYLES.card, padding: '40px' }} className="border-2 border-dashed border-slate-300 bg-transparent cursor-pointer hover:border-blue-500 transition-colors flex flex-col items-center justify-center gap-4">
                            <div className="p-4 bg-blue-600 rounded-full text-white"><Plus /></div>
                            <span className="font-bold">Nieuwe Wedstrijd</span>
                        </div>
                        {competitions.map(c => (
                            <div key={c.id} style={{ ...UI_STYLES.card, padding: '24px' }} className="text-left cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveCompId(c.id)}>
                                <span style={UI_STYLES.badge('#2563eb')}>{c.date}</span>
                                <h3 className="text-xl font-bold mt-3 mb-1">{c.name}</h3>
                                <p className="text-sm text-slate-500 flex items-center gap-1"><MapPin size={14}/> {c.location}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        const selectedComp = competitions.find(c => c.id === activeCompId);

        return (
            <div className="max-w-6xl mx-auto flex flex-col gap-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => setActiveCompId(null)} style={UI_STYLES.btn('#f1f5f9', '#475569')}><ArrowLeft size={18}/></button>
                    <h1 className="text-3xl font-black">{selectedComp?.name}</h1>
                </div>

                <div className="flex border-b border-slate-200 gap-4">
                    <button onClick={() => setMgmtTab('overview')} style={UI_STYLES.tab(mgmtTab === 'overview')}>OVERZICHT</button>
                    <button onClick={() => setMgmtTab('skippers')} style={UI_STYLES.tab(mgmtTab === 'skippers')}>DEELNEMERS ({Object.keys(skippers).length})</button>
                    <button onClick={() => setMgmtTab('heats')} style={UI_STYLES.tab(mgmtTab === 'heats')}>REEKSEN ({heats.length})</button>
                </div>

                {mgmtTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div style={UI_STYLES.card} className="p-6">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deelnemers</div>
                            <div className="text-4xl font-black mt-2">{Object.keys(skippers).length}</div>
                        </div>
                        <div style={UI_STYLES.card} className="p-6">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Totaal Reeksen</div>
                            <div className="text-4xl font-black mt-2">{heats.length}</div>
                        </div>
                        <div style={UI_STYLES.card} className="p-6">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Locatie</div>
                            <div className="text-xl font-bold mt-2">{selectedComp?.location}</div>
                        </div>
                    </div>
                )}

                {mgmtTab === 'skippers' && (
                    <div style={UI_STYLES.card} className="p-6">
                        <div className="flex justify-between mb-6">
                            <div className="relative w-72">
                                <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                                <input placeholder="Zoek skipper..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
                            </div>
                            <div className="flex gap-2">
                                <label style={UI_STYLES.btn('#f1f5f9', '#475569')} className="cursor-pointer">
                                    <Upload size={18}/> Import CSV
                                    <input type="file" hidden accept=".csv,.txt" onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const text = await file.text();
                                        const lines = text.split('\n').filter(l => l.trim());
                                        const batch = writeBatch(db);
                                        lines.slice(1).forEach(line => {
                                            const [naam, club, categorie] = line.split(',').map(s => s.trim());
                                            if (naam) {
                                                const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'skippers'));
                                                batch.set(ref, { naam, club, categorie });
                                            }
                                        });
                                        await batch.commit();
                                    }} />
                                </label>
                                <button onClick={async () => {
                                    const list = Object.entries(skippers).map(([id, d]) => ({id, ...d}));
                                    const batch = writeBatch(db);
                                    for(let i=0; i<list.length; i+=5) {
                                        const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats'));
                                        batch.set(ref, {
                                            reeks: Math.floor(i/5)+1,
                                            type: 'freestyle',
                                            onderdeel: 'Individual Freestyle',
                                            status: 'wachtend',
                                            slots: list.slice(i, i+5).map((s, idx) => ({ veld: idx+1, skipperId: s.id }))
                                        });
                                    }
                                    await batch.commit();
                                    setMgmtTab('heats');
                                }} style={UI_STYLES.btn()}><RefreshCw size={18}/> Genereer Reeksen</button>
                            </div>
                        </div>
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-slate-100">
                                <tr>
                                    <th className="p-3">Naam</th>
                                    <th className="p-3">Club</th>
                                    <th className="p-3">Categorie</th>
                                    <th className="p-3">Acties</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(skippers).map(([id, s]) => (
                                    <tr key={id} className="border-b border-slate-50">
                                        <td className="p-3 font-semibold">{s.naam}</td>
                                        <td className="p-3 text-slate-600">{s.club}</td>
                                        <td className="p-3 text-slate-600">{s.categorie}</td>
                                        <td className="p-3"><Trash2 size={16} className="text-red-400 cursor-pointer" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ==========================================
    // 5. SUB-RENDERER: LIVE FREESTYLE
    // ==========================================
    const renderLive = () => (
        <div className="max-w-[1400px] mx-auto flex flex-col gap-6 h-full">
            <div className="flex justify-between items-center">
                <div className="flex gap-2 p-1 bg-slate-200 rounded-xl">
                    <button onClick={() => setActiveTab('speed')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'speed' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>SPEED</button>
                    <button onClick={() => setActiveTab('freestyle')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'freestyle' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>FREESTYLE</button>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Huidige Reeks</div>
                        <div className="text-2xl font-black text-slate-800">
                            {currentHeatData?.reeks || '-'} <span className="text-slate-300 font-light text-xl">/ {activeTab === 'speed' ? speedHeats.length : freestyleHeats.length}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => updateCurrentHeat(activeTab, -1)} style={UI_STYLES.btn('#f1f5f9', '#475569')}><SkipBack size={18}/></button>
                        <button onClick={() => updateCurrentHeat(activeTab, 1)} style={UI_STYLES.btn('#f1f5f9', '#475569')}><SkipForward size={18}/></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div style={UI_STYLES.card} className="p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-black m-0">{activeTab === 'speed' ? 'Speed' : 'Freestyle'} Reeks {currentHeatData?.reeks}</h2>
                            {currentHeatData?.status === 'voltooid' && <span style={UI_STYLES.badge('#16a34a')}>✓ VOLTOOID</span>}
                        </div>

                        <div className="flex flex-col gap-4 flex-1">
                            {[1, 2, 3, 4, 5].map(v => {
                                const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                                const sk = skippers[slot?.skipperId];
                                return (
                                    <div key={v} className={`flex items-center p-6 rounded-2xl border-2 transition-all ${sk ? 'bg-slate-50 border-slate-200' : 'bg-white border-dashed border-slate-200 opacity-50'}`}>
                                        <div className="w-24 text-sm font-black text-slate-400">VELD {v}</div>
                                        {sk ? (
                                            <div className="flex-1 flex justify-between items-center">
                                                <div>
                                                    <div className="text-2xl font-black text-slate-800">{sk.naam}</div>
                                                    <div className="text-sm font-bold text-slate-500 uppercase">{sk.club}</div>
                                                </div>
                                                <button style={UI_STYLES.btn('#f1f5f9', '#64748b')}><Volume2 size={18}/> Audio</button>
                                            </div>
                                        ) : <div className="italic text-slate-300 font-medium">Geen skipper toegewezen</div>}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center">
                            <button 
                                onClick={async () => {
                                    if (!currentHeatData) return;
                                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats', currentHeatData.id), { status: 'voltooid' });
                                    updateCurrentHeat(activeTab, 1);
                                }}
                                className="bg-green-600 text-white px-12 py-5 rounded-2xl font-black text-xl flex items-center gap-3 shadow-lg shadow-green-100 hover:scale-105 active:scale-95 transition-all"
                            >
                                <CheckCircle2 size={24}/> VOLGENDE REEKS
                            </button>
                        </div>
                    </div>
                </div>

                <div style={UI_STYLES.card} className="flex flex-col">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 font-black text-xs uppercase tracking-widest text-slate-400">Programma</div>
                    <div className="overflow-y-auto p-2">
                        {(activeTab === 'speed' ? speedHeats : freestyleHeats).map(h => (
                            <div 
                                key={h.id}
                                onClick={() => updateCurrentHeat(activeTab, h.reeks - (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat))}
                                className={`p-4 rounded-xl cursor-pointer mb-1 transition-all flex justify-between items-center ${h.reeks === (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}
                            >
                                <div>
                                    <div className={`text-sm font-black ${h.reeks === (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat) ? 'text-blue-600' : 'text-slate-700'}`}>Reeks {h.reeks}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{h.status === 'voltooid' ? 'Klaar' : 'Wachtend'}</div>
                                </div>
                                {h.status === 'voltooid' && <CheckCircle2 size={14} className="text-green-500" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    // ==========================================
    // 6. MAIN RENDER LOOP
    // ==========================================
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                body { font-family: 'Inter', sans-serif; }
            `}</style>
            
            {/* Header */}
            <header className="h-[72px] bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Trophy size={20} />
                    </div>
                    <div className="text-xl font-black tracking-tighter">ROPESCORE <span className="text-blue-600">PRO</span></div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                    <button onClick={() => setView('management')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${view === 'management' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Layout size={16}/> BEHEER</button>
                    <button onClick={() => setView('live')} disabled={!activeCompId} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${!activeCompId ? 'opacity-30' : ''} ${view === 'live' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Play size={16}/> LIVE</button>
                    <button onClick={() => setView('display')} disabled={!activeCompId} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${!activeCompId ? 'opacity-30' : ''} ${view === 'display' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Monitor size={16}/> DISPLAY</button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white"></div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-8">
                {view === 'management' && renderManagement()}
                {view === 'live' && activeCompId && renderLive()}
                {view === 'display' && activeCompId && (
                    <div className="fixed inset-0 bg-[#020617] text-white p-12 flex flex-col z-[100]">
                        <div className="flex justify-between items-end border-b border-slate-800 pb-8 mb-12">
                            <div>
                                <div className="text-blue-400 font-black tracking-[0.2em] mb-4 text-xl">{competitions.find(c => c.id === activeCompId)?.name.toUpperCase()}</div>
                                <div className="text-7xl font-black tracking-tighter">{currentHeatData?.onderdeel || 'PAUZE'}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-500 font-bold text-2xl mb-2">REEKS</div>
                                <div className="text-9xl font-black leading-none text-blue-500">{currentHeatData?.reeks || '-'}</div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6 flex-1 justify-center">
                            {[1, 2, 3, 4, 5].map(v => {
                                const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                                const sk = skippers[slot?.skipperId];
                                return (
                                    <div key={v} className={`flex items-center p-8 rounded-[40px] border-2 transition-all ${sk ? 'bg-white/5 border-white/10' : 'bg-transparent border-dashed border-white/5 opacity-20'}`}>
                                        <div className="w-48 text-3xl font-black text-blue-400/50 italic">VELD {v}</div>
                                        {sk ? (
                                            <div className="flex-1 flex justify-between items-center">
                                                <div className="text-6xl font-black tracking-tight">{sk.naam}</div>
                                                <div className="text-3xl font-medium text-slate-500">{sk.club}</div>
                                            </div>
                                        ) : <div className="text-4xl text-slate-800 font-black uppercase">Vrij</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* Modals */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-6">
                    <div style={UI_STYLES.card} className="w-full max-w-md p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black">Nieuwe Wedstrijd</h2>
                            <X className="cursor-pointer text-slate-400" onClick={() => setShowCreateModal(false)} />
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const data = new FormData(e.target);
                            handleCreateCompetition({
                                name: data.get('name'),
                                date: data.get('date'),
                                location: data.get('location')
                            });
                        }} className="flex flex-col gap-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Naam</label>
                                <input name="name" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Bijv. BK Masters 2024" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Datum</label>
                                    <input name="date" type="date" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Locatie</label>
                                    <input name="location" required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Stad" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg mt-4 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">WEDSTRIJD AANMAKEN</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
