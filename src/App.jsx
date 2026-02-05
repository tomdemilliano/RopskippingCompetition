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
    SkipForward, SkipBack, RefreshCw, Volume2, CheckCircle2, Circle, Save, MoreVertical,
    Activity, Clock, Layers, Star, Zap, Shield
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATIE
// ==========================================

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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ropescore-ultimate-wide';

// ==========================================
// 2. INLINE STYLES OBJECTS (Gegarandeerde weergave)
// ==========================================

const styles = {
    body: {
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: '#0f172a',
        margin: 0
    },
    nav: {
        height: '80px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    },
    container: {
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '40px'
    },
    card: {
        backgroundColor: 'white',
        borderRadius: '24px',
        border: '1px solid #e2e8f0',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
    },
    btnPrimary: {
        background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '16px',
        fontWeight: '800',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
    },
    displayScreen: {
        backgroundColor: '#020617',
        color: 'white',
        minHeight: '100vh',
        padding: '60px',
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        overflow: 'hidden'
    },
    veldCard: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '40px',
        padding: '24px 48px',
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px'
    }
};

// ==========================================
// 3. HOOFD COMPONENT
// ==========================================

export default function App() {
    const [view, setView] = useState('management'); 
    const [mgmtTab, setMgmtTab] = useState('overview'); 
    const [activeTab, setActiveTab] = useState('speed');
    const [user, setUser] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [activeCompId, setActiveCompId] = useState(null);
    const [skippers, setSkippers] = useState({});
    const [heats, setHeats] = useState([]);
    const [compSettings, setCompSettings] = useState({});

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

    const currentHeatData = useMemo(() => {
        const heatList = heats.filter(h => h.type === activeTab).sort((a,b) => a.reeks - b.reeks);
        const currentNr = activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1);
        return heatList.find(h => h.reeks === currentNr);
    }, [heats, activeTab, compSettings]);

    // ==========================================
    // 4. SUB-VIEWS
    // ==========================================

    const Management = () => (
        <div style={styles.container}>
            {!activeCompId ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                        <div>
                            <h1 style={{ fontSize: '48px', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>Events</h1>
                            <p style={{ color: '#64748b', fontSize: '18px', margin: '8px 0 0 0' }}>Selecteer een wedstrijd om te beheren.</p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                        {competitions.map(c => (
                            <div key={c.id} onClick={() => setActiveCompId(c.id)} style={{...styles.card, cursor: 'pointer', borderBottom: '6px solid #4f46e5' }}>
                                <div style={{ color: '#4f46e5', marginBottom: '16px' }}><Calendar size={32} /></div>
                                <h3 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 8px 0' }}>{c.name}</h3>
                                <p style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}><MapPin size={14}/> {c.location}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div>
                    <button onClick={() => setActiveCompId(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontWeight: '700' }}>
                        <ArrowLeft size={20}/> TERUG NAAR OVERZICHT
                    </button>
                    <div style={{...styles.card, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '60px', position: 'relative', overflow: 'hidden' }}>
                        <Zap style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '200px', height: '200px', color: 'rgba(255,255,255,0.03)' }} />
                        <h2 style={{ fontSize: '56px', fontWeight: '900', margin: 0 }}>{competitions.find(c => c.id === activeCompId)?.name}</h2>
                        <p style={{ fontSize: '20px', opacity: 0.6, marginBottom: '40px' }}>Klaar om de wedstrijd te starten?</p>
                        <button onClick={() => setView('live')} style={{...styles.btnPrimary, padding: '20px 40px', fontSize: '18px' }}>START LIVE MODUS <ChevronRight/></button>
                    </div>
                </div>
            )}
        </div>
    );

    const Live = () => (
        <div style={styles.container}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
                <div style={styles.card}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
                        <button onClick={() => setActiveTab('speed')} style={{...styles.btnPrimary, background: activeTab === 'speed' ? '#4f46e5' : '#f1f5f9', color: activeTab === 'speed' ? 'white' : '#64748b', boxShadow: 'none' }}>SPEED</button>
                        <button onClick={() => setActiveTab('freestyle')} style={{...styles.btnPrimary, background: activeTab === 'freestyle' ? '#c026d3' : '#f1f5f9', color: activeTab === 'freestyle' ? 'white' : '#64748b', boxShadow: 'none' }}>FREESTYLE</button>
                    </div>

                    <div style={{ marginBottom: '60px' }}>
                        <span style={{ color: '#4f46e5', fontWeight: '900', fontSize: '12px', letterSpacing: '2px' }}>REEKS {(activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat) || 1}</span>
                        <h2 style={{ fontSize: '72px', fontWeight: '900', margin: 0, letterSpacing: '-2px' }}>{currentHeatData?.onderdeel || 'Geen Reeks'}</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                        {[1, 2, 3, 4, 5].map(v => {
                            const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                            const sk = skippers[slot?.skipperId];
                            return (
                                <div key={v} style={{ padding: '24px', backgroundColor: '#f8fafc', borderRadius: '24px', textAlign: 'center', border: '2px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#cbd5e1', marginBottom: '16px' }}>VELD {v}</div>
                                    <div style={{ width: '60px', height: '60px', backgroundColor: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: '900', color: '#4f46e5', fontSize: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        {sk ? sk.naam[0] : '-'}
                                    </div>
                                    <div style={{ fontWeight: '800', fontSize: '14px' }}>{sk?.naam || 'Leeg'}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ ...styles.card, height: 'fit-content' }}>
                    <h3 style={{ fontWeight: '900', marginBottom: '24px' }}>Schema</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {heats.filter(h => h.type === activeTab).map(h => (
                            <div key={h.id} style={{ padding: '16px', borderRadius: '16px', backgroundColor: h.reeks === (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat) ? '#eef2ff' : 'transparent', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '12px' }}>{h.reeks}</div>
                                <div style={{ fontWeight: '700' }}>{h.onderdeel}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const Display = () => (
        <div style={styles.displayScreen}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '40px', marginBottom: '60px' }}>
                    <div>
                        <div style={{ color: '#4f46e5', fontWeight: '900', fontSize: '24px', letterSpacing: '8px', marginBottom: '16px' }}>PK ROPE SKIPPING</div>
                        <h1 style={{ fontSize: '120px', fontWeight: '900', margin: 0, lineHeight: 0.9, fontStyle: 'italic' }}>{currentHeatData?.onderdeel || 'PAUZE'}</h1>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#4f46e5', fontWeight: '900', fontSize: '32px' }}>REEKS</div>
                        <div style={{ fontSize: '180px', fontWeight: '900', lineHeight: 1 }}>{currentHeatData?.reeks || '0'}</div>
                    </div>
                </header>

                <div>
                    {[1, 2, 3, 4, 5].map(v => {
                        const slot = currentHeatData?.slots?.find(s => Number(s.veld) === v);
                        const sk = skippers[slot?.skipperId];
                        return (
                            <div key={v} style={styles.veldCard}>
                                <div style={{ width: '200px', fontSize: '48px', fontWeight: '900', color: '#4f46e5', fontStyle: 'italic' }}>Veld {v}</div>
                                <div style={{ flex: 1, fontSize: '80px', fontWeight: '900', textTransform: 'uppercase' }}>{sk?.naam || ''}</div>
                                <div style={{ fontSize: '32px', opacity: 0.3, fontWeight: '700' }}>{sk?.club || ''}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <button onClick={() => setView('live')} style={{ position: 'absolute', top: '40px', right: '40px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '12px', borderRadius: '12px', cursor: 'pointer' }}>
                <X size={32}/>
            </button>
        </div>
    );

    return (
        <div style={styles.body}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
                * { box-sizing: border-box; }
                button { transition: all 0.2s; }
                button:hover { transform: translateY(-1px); opacity: 0.9; }
                button:active { transform: translateY(0); }
            `}</style>

            {view !== 'display' && (
                <nav style={styles.nav}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', backgroundColor: '#4f46e5', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <Zap fill="white" />
                        </div>
                        <div style={{ fontWeight: '900', fontSize: '24px', letterSpacing: '-1px' }}>ROPESCORE <span style={{ color: '#4f46e5' }}>PRO</span></div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '20px' }}>
                        <button onClick={() => setView('management')} style={{ padding: '10px 24px', border: 'none', background: view === 'management' ? 'white' : 'transparent', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', color: view === 'management' ? '#4f46e5' : '#64748b', boxShadow: view === 'management' ? '0 4px 6px rgba(0,0,0,0.05)' : 'none' }}>DASHBOARD</button>
                        <button onClick={() => setView('live')} disabled={!activeCompId} style={{ padding: '10px 24px', border: 'none', background: view === 'live' ? 'white' : 'transparent', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', color: view === 'live' ? '#4f46e5' : '#64748b', opacity: activeCompId ? 1 : 0.3 }}>LIVE CONTROLLER</button>
                        <button onClick={() => setView('display')} disabled={!activeCompId} style={{ ...styles.btnPrimary, padding: '10px 24px', opacity: activeCompId ? 1 : 0.3 }}>ZAAL DISPLAY</button>
                    </div>
                </nav>
            )}

            <main>
                {view === 'management' && <Management />}
                {view === 'live' && <Live />}
                {view === 'display' && <Display />}
            </main>
        </div>
    );
}
