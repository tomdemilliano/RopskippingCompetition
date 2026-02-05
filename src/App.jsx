import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, addDoc, query, deleteDoc 
} from 'firebase/firestore';
import { 
    getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { Layout, Users, Play, Monitor, Plus, Calendar, MapPin, ChevronLeft, ChevronRight, Upload, Trash2 } from 'lucide-react';

// Firebase configuratie
const firebaseConfig = {
    apiKey: "AIzaSyBdlKc-a_4Xt9MY_2TjcfkXT7bqJsDr8yY",
    authDomain: "ropeskippingcontest.firebaseapp.com",
    projectId: "ropeskippingcontest",
    storageBucket: "ropeskippingcontest.firebasestorage.app",
    messagingSenderId: "430066523717",
    appId: "1:430066523717:web:eea53ced41773af66a4d2c",
};

// Initialisatie
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-pro-ultimate';

// Inline CSS Injectie voor animaties en fonts
const GlobalStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@700&display=swap');
        
        body { 
            margin: 0; 
            font-family: 'Inter', -apple-system, sans-serif; 
            background-color: #f8fafc;
            color: #0f172a;
        }

        .pulse-active {
            animation: pulse-animation 2s infinite;
        }

        @keyframes pulse-animation {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
        }
    `}</style>
);

export default function App() {
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

    // Auth Logic
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Auth error:", error);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    // Listen to all competitions
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setCompetitions(list);
            if (!activeCompId && list.length > 0) {
                const active = list.find(c => c.status === 'actief') || list[0];
                setActiveCompId(active.id);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Listen to active competition data
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
        if (!user) return;
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'competitions'), {
            ...newComp, currentSpeedHeat: 1, currentFreestyleHeat: 1
        });
        setNewComp({ name: '', date: '', location: '', status: 'gepland' });
        setActiveCompId(docRef.id);
    };

    const handleDeleteComp = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Weet je zeker dat je deze wedstrijd wilt verwijderen?")) return;
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', id));
        if (activeCompId === id) setActiveCompId(null);
    };

    const handleImport = async () => {
        if (!csvInput || !activeCompId || !user) return;
        const batch = writeBatch(db);
        const lines = csvInput.split('\n').filter(l => l.trim());
        const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));

        rows.forEach(row => {
            const reeksNum = parseInt(row[0]);
            const baseRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
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
    };

    const updateHeat = async (delta) => {
        if (!user || !activeCompId) return;
        const key = activeTab === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), {
            [key]: Math.max(1, (compSettings[key] || 1) + delta)
        });
    };

    // UI Styles
    const styles = {
        appContainer: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
        header: { backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        nav: { display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' },
        navButton: (active) => ({
            padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 900, border: 'none', cursor: 'pointer',
            backgroundColor: active ? 'white' : 'transparent', color: active ? '#2563eb' : '#64748b', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
        }),
        main: { flex: 1, padding: '2rem', overflow: 'hidden' },
        card: { backgroundColor: 'white', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
        input: { width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #f1f5f9', backgroundColor: '#f8fafc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
        btnPrimary: { backgroundColor: '#2563eb', color: 'white', padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 900, fontSize: '12px', cursor: 'pointer', letterSpacing: '0.05em' },
        badge: (status) => ({
            padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase',
            backgroundColor: status === 'actief' ? '#dcfce7' : '#f1f5f9', color: status === 'actief' ? '#166534' : '#64748b'
        })
    };

    return (
        <div style={styles.appContainer}>
            <GlobalStyles />
            
            <header style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.05em' }}>
                        ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span>
                    </div>
                    <nav style={styles.nav}>
                        {[
                            { id: 'management', label: 'Beheer', icon: Layout },
                            { id: 'live', label: 'Live', icon: Play },
                            { id: 'display', label: 'Scherm', icon: Monitor }
                        ].map(v => (
                            <button key={v.id} onClick={() => setView(v.id)} style={styles.navButton(view === v.id)}>
                                <v.icon size={14} /> {v.label.toUpperCase()}
                            </button>
                        ))}
                    </nav>
                </div>
                {selectedComp && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={styles.badge(selectedComp.status)} className={selectedComp.status === 'actief' ? 'pulse-active' : ''}>
                            {selectedComp.status}
                        </span>
                        <span style={{ fontWeight: 800 }}>{selectedComp.name}</span>
                    </div>
                )}
            </header>

            <main style={styles.main}>
                {view === 'management' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', height: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
                            <div style={styles.card}>
                                <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem' }}>Nieuwe Wedstrijd</h3>
                                <form onSubmit={handleCreateComp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input required placeholder="Wedstrijdnaam" style={styles.input} value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <input placeholder="Locatie" style={styles.input} value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} />
                                        <input type="date" style={styles.input} value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
                                    </div>
                                    <button style={styles.btnPrimary}>WEDSTRIJD OPSLAAN</button>
                                </form>
                            </div>
                            
                            <div style={{ ...styles.card, flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', fontWeight: 900, fontSize: '10px', color: '#94a3b8' }}>ALLE WEDSTRIJDEN</div>
                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                                    {competitions.map(c => (
                                        <div key={c.id} onClick={() => setActiveCompId(c.id)} style={{ 
                                            padding: '1.5rem', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                                            backgroundColor: activeCompId === c.id ? '#eff6ff' : 'transparent',
                                            borderLeft: activeCompId === c.id ? '4px solid #2563eb' : '4px solid transparent',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '16px' }}>{c.name}</div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', fontWeight: 700 }}>{c.location} • {c.date}</div>
                                            </div>
                                            <button onClick={(e) => handleDeleteComp(c.id, e)} style={{ border: 'none', background: 'none', color: '#cbd5e1', cursor: 'pointer' }}><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
                            {selectedComp ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                        <div style={{ ...styles.card, backgroundColor: '#2563eb', color: 'white', border: 'none' }}>
                                            <div style={{ fontSize: '10px', fontWeight: 900, opacity: 0.7, marginBottom: '12px' }}>STATUS</div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {['gepland', 'actief', 'afgesloten'].map(s => (
                                                    <button key={s} onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), {status: s})} style={{
                                                        padding: '4px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 900, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                                                        backgroundColor: selectedComp.status === s ? 'white' : 'transparent', color: selectedComp.status === s ? '#2563eb' : 'white'
                                                    }}>{s.toUpperCase()}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={styles.card}>
                                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', marginBottom: '4px' }}>SPEED REEKSEN</div>
                                            <div style={{ fontSize: '32px', fontWeight: 900 }}>{stats.speed}</div>
                                        </div>
                                        <div style={styles.card}>
                                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', marginBottom: '4px' }}>FREESTYLE</div>
                                            <div style={{ fontSize: '32px', fontWeight: 900 }}>{stats.freestyle}</div>
                                        </div>
                                    </div>

                                    <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h2 style={{ fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}><Upload size={20}/> DATA IMPORT</h2>
                                            <div style={styles.nav}>
                                                <button onClick={() => setImportType('speed')} style={styles.navButton(importType === 'speed')}>SPEED</button>
                                                <button onClick={() => setImportType('freestyle')} style={styles.navButton(importType === 'freestyle')}>FREESTYLE</button>
                                            </div>
                                        </div>
                                        <textarea 
                                            style={{ flex: 1, backgroundColor: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: '16px', padding: '1rem', fontFamily: 'monospace', fontSize: '12px', resize: 'none', outline: 'none' }}
                                            value={csvInput} onChange={e => setCsvInput(e.target.value)}
                                            placeholder="Plak CSV data (met headers) hier..."
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Gebruik het standaard export format.</span>
                                            <button onClick={handleImport} style={{ ...styles.btnPrimary, padding: '12px 30px' }}>IMPORT STARTEN</button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, border: '4px dashed #e2e8f0', borderRadius: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                    <Layout size={48} />
                                    <p style={{ fontWeight: 900, marginTop: '1rem', fontSize: '12px', letterSpacing: '0.1em' }}>SELECTEER EEN WEDSTRIJD</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'live' && selectedComp && (
                    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', borderBottom: '2px solid #e2e8f0' }}>
                            <button onClick={() => setActiveTab('speed')} style={{ padding: '1rem 2rem', background: 'none', border: 'none', fontWeight: 900, cursor: 'pointer', borderBottom: activeTab === 'speed' ? '4px solid #2563eb' : '4px solid transparent', color: activeTab === 'speed' ? '#2563eb' : '#94a3b8' }}>SPEED</button>
                            <button onClick={() => setActiveTab('freestyle')} style={{ padding: '1rem 2rem', background: 'none', border: 'none', fontWeight: 900, cursor: 'pointer', borderBottom: activeTab === 'freestyle' ? '4px solid #7c3aed' : '4px solid transparent', color: activeTab === 'freestyle' ? '#7c3aed' : '#94a3b8' }}>FREESTYLE</button>
                        </div>

                        <div style={{ ...styles.card, textAlign: 'center', padding: '3rem' }}>
                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.2em', marginBottom: '1.5rem' }}>HUIDIGE REEKS</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem' }}>
                                <button onClick={() => updateHeat(-1)} style={{ width: '60px', height: '60px', borderRadius: '30px', border: 'none', backgroundColor: '#f1f5f9', cursor: 'pointer' }}><ChevronLeft/></button>
                                <div style={{ fontSize: '100px', fontWeight: 900, lineHeight: 1, fontFamily: 'JetBrains Mono' }}>
                                    {(activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1))}
                                </div>
                                <button onClick={() => updateHeat(1)} style={{ width: '60px', height: '60px', borderRadius: '30px', border: 'none', backgroundColor: '#f1f5f9', cursor: 'pointer' }}><ChevronRight/></button>
                            </div>
                            <div style={{ marginTop: '2rem' }}>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: '#2563eb' }}>{currentHeat?.onderdeel || 'Geen reeks gevonden'}</div>
                                <div style={{ fontWeight: 800, color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>PLANTIJD: {currentHeat?.uur || '--:--'}</div>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
                            {activeTab === 'speed' ? (
                                Array.from({length: 10}).map((_, i) => {
                                    const vNum = i + 1;
                                    const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                                    const sk = slot ? skippers[slot.skipperId] : null;
                                    return (
                                        <div key={vNum} style={{ ...styles.card, padding: '1rem 2rem', display: 'flex', alignItems: 'center', opacity: sk ? 1 : 0.2 }}>
                                            <div style={{ width: '100px', fontWeight: 900, color: '#2563eb', fontSize: '12px', fontStyle: 'italic' }}>VELD {vNum}</div>
                                            <div style={{ flex: 1, fontWeight: 900, fontSize: '18px' }}>{sk?.naam || 'Leeg'}</div>
                                            <div style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>{sk?.club}</div>
                                        </div>
                                    );
                                })
                            ) : (
                                currentHeat?.slots?.map((slot, i) => (
                                    <div key={i} style={{ ...styles.card, padding: '2rem', display: 'flex', alignItems: 'center' }}>
                                        <div style={{ width: '120px', fontWeight: 900, color: '#7c3aed', fontSize: '18px', fontStyle: 'italic' }}>{slot.veld}</div>
                                        <div style={{ flex: 1, fontWeight: 900, fontSize: '28px' }}>{skippers[slot.skipperId]?.naam}</div>
                                        <div style={{ fontWeight: 900, color: '#94a3b8' }}>{skippers[slot.skipperId]?.club}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {view === 'display' && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'white', zIndex: 1000, padding: '4rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem' }}>
                            <div>
                                <h1 style={{ fontSize: '120px', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.9, margin: 0 }}>{currentHeat?.onderdeel?.toUpperCase() || 'OFFLINE'}</h1>
                                <div style={{ fontSize: '24px', fontWeight: 900, color: '#2563eb', marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '6px', backgroundColor: '#2563eb' }} className="pulse-active"></div>
                                    LIVE WEDSTRIJD • {selectedComp?.name?.toUpperCase()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem' }}>
                                <div style={{ backgroundColor: '#f1f5f9', borderRadius: '40px', padding: '2rem 3rem', textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: '4px' }}>TIJD</div>
                                    <div style={{ fontSize: '60px', fontWeight: 900 }}>{currentHeat?.uur || '--:--'}</div>
                                </div>
                                <div style={{ backgroundColor: 'black', borderRadius: '40px', padding: '2rem 3rem', textAlign: 'right', color: 'white' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: '4px' }}>REEKS</div>
                                    <div style={{ fontSize: '60px', fontWeight: 900, fontFamily: 'JetBrains Mono' }}>
                                        {(activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                            {activeTab === 'speed' ? (
                                Array.from({length: 10}).map((_, i) => {
                                    const vNum = i + 1;
                                    const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                                    const sk = slot ? skippers[slot.skipperId] : null;
                                    return (
                                        <div key={vNum} style={{ 
                                            flex: 1, display: 'flex', alignItems: 'center', padding: '0 4rem', borderRadius: '30px', border: '4px solid #f1f5f9',
                                            opacity: sk ? 1 : 0.05, backgroundColor: sk ? 'white' : 'transparent'
                                        }}>
                                            <span style={{ width: '200px', fontSize: '24px', fontWeight: 900, color: '#2563eb', fontStyle: 'italic' }}>VELD {vNum}</span>
                                            <span style={{ flex: 1, fontSize: '56px', fontWeight: 900 }}>{sk?.naam || ''}</span>
                                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#cbd5e1' }}>{sk?.club || ''}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                currentHeat?.slots?.map((slot, i) => (
                                    <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 5rem', borderRadius: '50px', backgroundColor: 'white', border: '8px solid #f1f5f9' }}>
                                        <span style={{ width: '250px', fontSize: '48px', fontWeight: 900, color: '#7c3aed', fontStyle: 'italic' }}>{slot.veld}</span>
                                        <span style={{ flex: 1, fontSize: '100px', fontWeight: 900, letterSpacing: '-0.04em' }}>{skippers[slot.skipperId]?.naam}</span>
                                        <span style={{ fontSize: '48px', fontWeight: 900, color: '#cbd5e1' }}>{skippers[slot.skipperId]?.club}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <button onClick={() => setView('live')} style={{ position: 'absolute', bottom: '2rem', left: '2rem', opacity: 0.1, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '10px' }}>EXIT</button>
                    </div>
                )}
            </main>
        </div>
    );
}
