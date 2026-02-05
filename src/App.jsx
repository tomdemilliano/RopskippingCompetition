import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, addDoc, query, deleteDoc, getDocs 
} from 'firebase/firestore';
import { 
    getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
    Layout, Users, Play, Monitor, Plus, Calendar, MapPin, ChevronLeft, ChevronRight, 
    Upload, Trash2, Edit3, X, Search, Trophy, Settings, ArrowLeft, UserMinus, Timer,
    SkipForward, SkipBack, RefreshCw, Volume2
} from 'lucide-react';

// Firebase configuratie
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-ultimate';

const GlobalStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@700&display=swap');
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: #f1f5f9; color: #0f172a; }
        .pulse-active { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    `}</style>
);

export default function App() {
    // State management
    const [view, setView] = useState('management'); 
    const [activeCompId, setActiveCompId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [mgmtTab, setMgmtTab] = useState('overview'); 
    const [activeTab, setActiveTab] = useState('speed'); // speed of freestyle in LIVE view
    
    const [competitions, setCompetitions] = useState([]);
    const [skippers, setSkippers] = useState({});
    const [heats, setHeats] = useState([]);
    const [compSettings, setCompSettings] = useState({});
    
    const [csvInput, setCsvInput] = useState('');
    const [importType, setImportType] = useState('speed');
    const [newComp, setNewComp] = useState({ name: '', date: '', location: '', status: 'gepland' });
    const [user, setUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Timer States (Live)
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerRef = useRef(null);

    // Auth logic
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

    // Fetch all competitions
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'));
        return onSnapshot(q, (s) => setCompetitions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [user]);

    // Fetch active competition sub-data
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

    const selectedComp = competitions.find(c => c.id === activeCompId);

    // Filter heats per type
    const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed').sort((a,b) => a.reeks - b.reeks), [heats]);
    const freestyleHeats = useMemo(() => heats.filter(h => h.type === 'freestyle').sort((a,b) => a.reeks - b.reeks), [heats]);

    const currentHeatData = useMemo(() => {
        if (activeTab === 'speed') return speedHeats.find(h => h.reeks === (compSettings.currentSpeedHeat || 1));
        return freestyleHeats.find(h => h.reeks === (compSettings.currentFreestyleHeat || 1));
    }, [speedHeats, freestyleHeats, activeTab, compSettings]);

    // Handlers
    const handleCreateComp = async (e) => {
        e.preventDefault();
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
            ...newComp, currentSpeedHeat: 1, currentFreestyleHeat: 1, timerState: 'stop'
        });
        setNewComp({ name: '', date: '', location: '', status: 'gepland' });
        setShowCreateModal(false);
        setActiveCompId(docRef.id);
    };

    const handleUpdateComp = async () => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), compSettings);
    };

    const handleDeleteComp = async (id) => {
        if (!window.confirm("Wedstrijd definitief verwijderen?")) return;
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id));
        setActiveCompId(null);
    };

    const handleDeleteSkipper = async (skipperId) => {
        if (!window.confirm("Skipper overal verwijderen?")) return;
        const batch = writeBatch(db);
        const baseRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
        batch.delete(doc(collection(baseRef, 'skippers'), skipperId));
        heats.forEach(heat => {
            const newSlots = heat.slots.filter(s => s.skipperId !== skipperId);
            if (newSlots.length !== heat.slots.length) {
                batch.update(doc(collection(baseRef, 'heats'), heat.id), { slots: newSlots });
            }
        });
        await batch.commit();
    };

    const handleImport = async () => {
        if (!csvInput || !activeCompId) return;
        const batch = writeBatch(db);
        const rows = csvInput.split('\n').filter(l => l.trim()).slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
        const baseRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);

        rows.forEach(row => {
            const reeksNum = parseInt(row[0]);
            if (importType === 'speed') {
                const slots = [];
                for (let v = 1; v <= 10; v++) {
                    const club = row[3 + (v - 1) * 2], naam = row[4 + (v - 1) * 2];
                    if (naam) {
                        const sid = `s_${naam}_${club}`.replace(/\s/g, '_');
                        batch.set(doc(collection(baseRef, 'skippers'), sid), { id: sid, naam, club });
                        slots.push({ veldNr: v, skipperId: sid });
                    }
                }
                batch.set(doc(collection(baseRef, 'heats'), `s_${reeksNum}`), { type: 'speed', reeks: reeksNum, onderdeel: row[1], uur: row[2], slots });
            } else {
                const sid = `s_${row[2]}_${row[1]}`.replace(/\s/g, '_');
                batch.set(doc(collection(baseRef, 'skippers'), sid), { id: sid, naam: row[2], club: row[1] });
                batch.set(doc(collection(baseRef, 'heats'), `f_${reeksNum}`), { type: 'freestyle', reeks: reeksNum, onderdeel: 'Freestyle', uur: row[4], slots: [{ veld: row[3], skipperId: sid }] });
            }
        });
        await batch.commit();
        setCsvInput('');
        setMgmtTab('skippers');
    };

    // Live Handlers
    const updateCurrentHeat = async (type, delta) => {
        const field = type === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
        const newVal = Math.max(1, (compSettings[field] || 1) + delta);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), { [field]: newVal });
    };

    const handleTimerToggle = async () => {
        const newState = !isTimerRunning;
        setIsTimerRunning(newState);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), { 
            timerState: newState ? 'run' : 'stop' 
        });
    };

    // Styles
    const s = {
        card: { background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' },
        btn: (bg = '#2563eb', color = 'white') => ({ background: bg, color, padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }),
        input: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' },
        badge: (color) => ({ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: color + '15', color: color }),
        tab: (active) => ({ padding: '12px 24px', cursor: 'pointer', borderBottom: active ? '3px solid #2563eb' : '3px solid transparent', color: active ? '#2563eb' : '#64748b', fontWeight: 700, fontSize: '14px' })
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <GlobalStyles />
            
            {/* Navigatie */}
            <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
                <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
                <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                    <button onClick={() => setView('management')} style={{ ...s.btn(view === 'management' ? 'white' : 'transparent', view === 'management' ? '#2563eb' : '#64748b'), boxShadow: view === 'management' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}><Layout size={16}/> BEHEER</button>
                    <button onClick={() => setView('live')} style={{ ...s.btn(view === 'live' ? 'white' : 'transparent', view === 'live' ? '#2563eb' : '#64748b'), boxShadow: view === 'live' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }} disabled={!activeCompId}><Play size={16}/> LIVE</button>
                    <button onClick={() => setView('display')} style={{ ...s.btn(view === 'display' ? 'white' : 'transparent', view === 'display' ? '#2563eb' : '#64748b'), boxShadow: view === 'display' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }} disabled={!activeCompId}><Monitor size={16}/> SCHERM</button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                {/* MANAGEMENT VIEW */}
                {view === 'management' && !activeCompId && (
                    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h1 style={{ fontWeight: 900, fontSize: '28px' }}>Wedstrijden</h1>
                            <button onClick={() => setShowCreateModal(true)} style={s.btn()}><Plus size={20}/> NIEUWE WEDSTRIJD</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {competitions.map(c => (
                                <div key={c.id} style={{ ...s.card, cursor: 'pointer' }} onClick={() => setActiveCompId(c.id)}>
                                    <div style={{ padding: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <span style={s.badge(c.status === 'actief' ? '#16a34a' : '#64748b')}>{c.status.toUpperCase()}</span>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteComp(c.id); }} style={{ border: 'none', background: 'none', color: '#cbd5e1', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                        </div>
                                        <h2 style={{ fontWeight: 800, fontSize: '20px', margin: '0 0 0.5rem 0' }}>{c.name}</h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}><MapPin size={14}/> {c.location}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', marginTop: '4px' }}><Calendar size={14}/> {c.date}</div>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '12px', color: '#94a3b8' }}>KLIK VOOR BEHEER</span>
                                        <ArrowLeft size={16} style={{ transform: 'rotate(180deg)', color: '#2563eb' }}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'management' && activeCompId && (
                    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                        <button onClick={() => setActiveCompId(null)} style={{ ...s.btn('transparent', '#64748b'), padding: '0', marginBottom: '1.5rem' }}><ArrowLeft size={16}/> Terug naar overzicht</button>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                            <div>
                                <h1 style={{ fontWeight: 900, fontSize: '32px', margin: 0 }}>{selectedComp?.name}</h1>
                                <div style={{ display: 'flex', gap: '1rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 600 }}>
                                    <span>{selectedComp?.location}</span>
                                    <span>•</span>
                                    <span>{selectedComp?.date}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setMgmtTab('settings')} style={{ ...s.btn('#f1f5f9', '#475569') }}><Settings size={18}/> INSTELLINGEN</button>
                                <button onClick={() => setView('live')} style={s.btn()}><Play size={18}/> START LIVE MODUS</button>
                            </div>
                        </div>

                        <div style={s.card}>
                            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <div onClick={() => setMgmtTab('overview')} style={s.tab(mgmtTab === 'overview')}>DASHBOARD</div>
                                <div onClick={() => setMgmtTab('skippers')} style={s.tab(mgmtTab === 'skippers')}>DEELNEMERS ({Object.keys(skippers).length})</div>
                                <div onClick={() => setMgmtTab('imports')} style={s.tab(mgmtTab === 'imports')}>IMPORT & REEKSEN</div>
                            </div>
                            <div style={{ padding: '2rem' }}>
                                {mgmtTab === 'overview' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                                        <div style={{ ...s.card, padding: '1.5rem', textAlign: 'center' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 900, marginBottom: '0.5rem' }}>DEELNEMERS</div>
                                            <div style={{ fontSize: '42px', fontWeight: 900 }}>{Object.keys(skippers).length}</div>
                                        </div>
                                        <div style={{ ...s.card, padding: '1.5rem', textAlign: 'center' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 900, marginBottom: '0.5rem' }}>SPEED REEKSEN</div>
                                            <div style={{ fontSize: '42px', fontWeight: 900 }}>{speedHeats.length}</div>
                                        </div>
                                        <div style={{ ...s.card, padding: '1.5rem', textAlign: 'center' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 900, marginBottom: '0.5rem' }}>FREESTYLES</div>
                                            <div style={{ fontSize: '42px', fontWeight: 900 }}>{freestyleHeats.length}</div>
                                        </div>
                                    </div>
                                )}
                                {mgmtTab === 'skippers' && (
                                    <div>
                                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }}/>
                                                <input placeholder="Zoek skipper of club..." style={{ ...s.input, paddingLeft: '40px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                            </div>
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#94a3b8', fontSize: '12px', fontWeight: 900 }}>
                                                    <th style={{ padding: '1rem' }}>NAAM</th>
                                                    <th style={{ padding: '1rem' }}>CLUB</th>
                                                    <th style={{ padding: '1rem' }}>DEELNAMES</th>
                                                    <th style={{ padding: '1rem', textAlign: 'right' }}>ACTIES</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.values(skippers).filter(sk => 
                                                    sk.naam.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                    sk.club.toLowerCase().includes(searchTerm.toLowerCase())
                                                ).map(sk => {
                                                    const participations = heats.filter(h => h.slots.some(sl => sl.skipperId === sk.id));
                                                    return (
                                                        <tr key={sk.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '1rem', fontWeight: 700 }}>{sk.naam}</td>
                                                            <td style={{ padding: '1rem', color: '#64748b' }}>{sk.club}</td>
                                                            <td style={{ padding: '1rem' }}>
                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                    {participations.map(p => (
                                                                        <span key={p.id} style={{ fontSize: '9px', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                                                            {p.type === 'speed' ? 'S' : 'F'}{p.reeks}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                                <button onClick={() => handleDeleteSkipper(sk.id)} style={{ border: 'none', background: '#fef2f2', color: '#dc2626', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><UserMinus size={16}/></button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {mgmtTab === 'imports' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                                                <button onClick={() => setImportType('speed')} style={s.btn(importType === 'speed' ? 'white' : 'transparent', importType === 'speed' ? '#2563eb' : '#64748b')}>SPEED</button>
                                                <button onClick={() => setImportType('freestyle')} style={s.btn(importType === 'freestyle' ? 'white' : 'transparent', importType === 'freestyle' ? '#7c3aed' : '#64748b')}>FREESTYLE</button>
                                            </div>
                                        </div>
                                        <textarea 
                                            style={{ ...s.input, height: '200px', fontFamily: 'monospace', fontSize: '12px', background: '#f8fafc' }}
                                            placeholder="Plak CSV regels inclusief koprij..."
                                            value={csvInput}
                                            onChange={e => setCsvInput(e.target.value)}
                                        />
                                        <button onClick={handleImport} style={{ ...s.btn(), alignSelf: 'flex-end' }}>DATA IMPORTEREN</button>
                                    </div>
                                )}
                                {mgmtTab === 'settings' && (
                                    <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>WEDSTRIJDNAAM</label>
                                            <input style={s.input} value={compSettings.name || ''} onChange={e => setCompSettings({...compSettings, name: e.target.value})} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>LOCATIE</label>
                                            <input style={s.input} value={compSettings.location || ''} onChange={e => setCompSettings({...compSettings, location: e.target.value})} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>DATUM</label>
                                            <input type="date" style={s.input} value={compSettings.date || ''} onChange={e => setCompSettings({...compSettings, date: e.target.value})} />
                                        </div>
                                        <button onClick={handleUpdateComp} style={{ ...s.btn(), marginTop: '1rem' }}>WIJZIGINGEN OPSLAAN</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* LIVE VIEW */}
                {view === 'live' && activeCompId && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
                                <button onClick={() => setActiveTab('speed')} style={s.tab(activeTab === 'speed')}>SPEED</button>
                                <button onClick={() => setActiveTab('freestyle')} style={s.tab(activeTab === 'freestyle')}>FREESTYLE</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontWeight: 800, color: '#64748b' }}>REEKS {currentHeatData?.reeks || '-'} / {activeTab === 'speed' ? speedHeats.length : freestyleHeats.length}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => updateCurrentHeat(activeTab, -1)} style={{ ...s.btn('#f1f5f9', '#475569') }}><SkipBack size={18}/></button>
                                    <button onClick={() => updateCurrentHeat(activeTab, 1)} style={{ ...s.btn('#f1f5f9', '#475569') }}><SkipForward size={18}/></button>
                                </div>
                            </div>
                        </div>

                        {activeTab === 'speed' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', flex: 1 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ ...s.card, flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#2563eb', marginBottom: '1rem', letterSpacing: '0.1em' }}>{currentHeatData?.onderdeel?.toUpperCase() || 'GEEN DATA'}</div>
                                        <div style={{ fontSize: '120px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: isTimerRunning ? '#2563eb' : '#0f172a' }}>
                                            {timer.toFixed(1)}
                                        </div>
                                        <button 
                                            onClick={handleTimerToggle}
                                            style={{ ...s.btn(isTimerRunning ? '#ef4444' : '#2563eb'), padding: '20px 60px', fontSize: '20px', marginTop: '2rem' }}
                                        >
                                            {isTimerRunning ? 'STOP TIMER' : 'START TIMER'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                                        {[1,2,3,4,5,6,7,8,9,10].map(v => {
                                            const slot = currentHeatData?.slots?.find(s => s.veldNr === v);
                                            const skipper = skippers[slot?.skipperId];
                                            return (
                                                <div key={v} style={{ ...s.card, padding: '1rem', background: slot ? 'white' : '#f8fafc', border: slot ? '1px solid #e2e8f0' : '1px dashed #cbd5e1' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8' }}>VELD {v}</div>
                                                    <div style={{ fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{skipper?.naam || '-'}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{skipper?.club || '-'}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>REEKS OVERZICHT</div>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }} className="custom-scrollbar">
                                        {speedHeats.map(h => (
                                            <div key={h.id} style={{ padding: '0.75rem', borderRadius: '8px', background: h.reeks === compSettings.currentSpeedHeat ? '#eff6ff' : 'transparent', color: h.reeks === compSettings.currentSpeedHeat ? '#2563eb' : '#0f172a', marginBottom: '4px', cursor: 'pointer' }} onClick={() => updateCurrentHeat('speed', h.reeks - compSettings.currentSpeedHeat)}>
                                                <div style={{ fontSize: '12px', fontWeight: 800 }}>Reeks {h.reeks} - {h.uur}</div>
                                                <div style={{ fontSize: '11px', opacity: 0.7 }}>{h.onderdeel}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Freestyle Live View */
                            <div style={{ ...s.card, flex: 1, padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                {currentHeatData?.slots?.[0] ? (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#7c3aed', marginBottom: '2rem', letterSpacing: '0.2em' }}>NU OP HET VELD (FREESTYLE)</div>
                                        <div style={{ fontSize: '64px', fontWeight: 900, marginBottom: '1rem' }}>{skippers[currentHeatData.slots[0].skipperId]?.naam}</div>
                                        <div style={{ fontSize: '24px', fontWeight: 600, color: '#64748b' }}>{skippers[currentHeatData.slots[0].skipperId]?.club}</div>
                                        <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                            <button style={{ ...s.btn('#7c3aed'), padding: '15px 40px' }}><Volume2 size={20}/> SPEEL MUZIEK</button>
                                            <button onClick={() => updateCurrentHeat('freestyle', 1)} style={{ ...s.btn('#f1f5f9', '#475569'), padding: '15px 40px' }}>VOLGENDE <ChevronRight/></button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: '#94a3b8' }}>Geen freestyle data gevonden voor deze reeks.</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* DISPLAY VIEW (PUBLIC SCREEN) */}
                {view === 'display' && activeCompId && (
                    <div style={{ flex: 1, background: '#0f172a', margin: '-2rem', display: 'flex', flexDirection: 'column', color: 'white' }}>
                        <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>{selectedComp?.name?.toUpperCase()}</div>
                                <div style={{ fontSize: '24px', fontWeight: 900 }}>{currentHeatData?.onderdeel || 'Pauze'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '14px', fontWeight: 800, color: '#94a3b8' }}>REEKS</div>
                                <div style={{ fontSize: '32px', fontWeight: 900 }}>{currentHeatData?.reeks || '-'}</div>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                            {activeTab === 'speed' ? (
                                <div style={{ width: '100%', maxWidth: '1400px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '2rem', height: '80%' }}>
                                    {[1,2,3,4,5,6,7,8,9,10].map(v => {
                                        const slot = currentHeatData?.slots?.find(s => s.veldNr === v);
                                        const sk = skippers[slot?.skipperId];
                                        return (
                                            <div key={v} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <div style={{ fontSize: '16px', fontWeight: 900, color: '#38bdf8', marginBottom: '1rem' }}>VELD {v}</div>
                                                <div style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.5rem' }}>{sk?.naam || '-'}</div>
                                                <div style={{ fontSize: '18px', color: '#94a3b8' }}>{sk?.club || '-'}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#a78bfa', marginBottom: '2rem', letterSpacing: '0.3em' }}>NEXT UP</div>
                                    <div style={{ fontSize: '120px', fontWeight: 900, lineHeight: 1 }}>{skippers[currentHeatData?.slots?.[0]?.skipperId]?.naam || 'EINDE'}</div>
                                    <div style={{ fontSize: '48px', color: '#94a3b8', marginTop: '2rem' }}>{skippers[currentHeatData?.slots?.[0]?.skipperId]?.club || '-'}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Modal voor nieuwe wedstrijd */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ ...s.card, width: '400px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontWeight: 900, margin: 0 }}>Nieuwe Wedstrijd</h2>
                            <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X/></button>
                        </div>
                        <form onSubmit={handleCreateComp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input required placeholder="Naam" style={s.input} value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
                            <input required placeholder="Locatie" style={s.input} value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} />
                            <input required type="date" style={s.input} value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
                            <button style={s.btn()}>WEDSTRIJD AANMAKEN</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
