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
    Upload, Trash2, Edit3, X, Search, Trophy, Settings, ArrowLeft, UserMinus, Timer as TimerIcon,
    SkipForward, SkipBack, RefreshCw, Volume2, CheckCircle2, Circle
} from 'lucide-react';

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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    `}</style>
);

export default function App() {
    const [view, setView] = useState('management'); 
    const [activeCompId, setActiveCompId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [mgmtTab, setMgmtTab] = useState('overview'); 
    const [activeTab, setActiveTab] = useState('freestyle');
    
    const [competitions, setCompetitions] = useState([]);
    const [skippers, setSkippers] = useState({});
    const [heats, setHeats] = useState([]);
    const [compSettings, setCompSettings] = useState({});
    const [user, setUser] = useState(null);

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

    const speedHeats = useMemo(() => heats.filter(h => h.type === 'speed').sort((a,b) => a.reeks - b.reeks), [heats]);
    const freestyleHeats = useMemo(() => heats.filter(h => h.type === 'freestyle').sort((a,b) => a.reeks - b.reeks), [heats]);

    const currentHeatData = useMemo(() => {
        if (activeTab === 'speed') return speedHeats.find(h => h.reeks === (compSettings.currentSpeedHeat || 1));
        return freestyleHeats.find(h => h.reeks === (compSettings.currentFreestyleHeat || 1));
    }, [speedHeats, freestyleHeats, activeTab, compSettings]);

    const updateCurrentHeat = async (type, delta) => {
        const field = type === 'speed' ? 'currentSpeedHeat' : 'currentFreestyleHeat';
        const newVal = Math.max(1, (compSettings[field] || 1) + delta);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), { [field]: newVal });
    };

    const markHeatFinished = async () => {
        if (!currentHeatData) return;
        
        // Update heat status
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats', currentHeatData.id), {
            status: 'voltooid'
        });

        // Ga naar volgende reeks
        updateCurrentHeat(activeTab, 1);
    };

    const s = {
        card: { background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' },
        btn: (bg = '#2563eb', color = 'white') => ({ background: bg, color, padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }),
        tab: (active) => ({ padding: '12px 24px', cursor: 'pointer', borderBottom: active ? '3px solid #2563eb' : '3px solid transparent', color: active ? '#2563eb' : '#64748b', fontWeight: 700, fontSize: '14px' }),
        badge: (color) => ({ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, background: color + '15', color: color }),
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <GlobalStyles />
            
            <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 2rem', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
                <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em' }}>ROPESCORE <span style={{ color: '#2563eb' }}>PRO</span></div>
                <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                    <button onClick={() => setView('management')} style={{ ...s.btn(view === 'management' ? 'white' : 'transparent', view === 'management' ? '#2563eb' : '#64748b') }}><Layout size={16}/> BEHEER</button>
                    <button onClick={() => setView('live')} style={{ ...s.btn(view === 'live' ? 'white' : 'transparent', view === 'live' ? '#2563eb' : '#64748b') }} disabled={!activeCompId}><Play size={16}/> LIVE</button>
                    <button onClick={() => setView('display')} style={{ ...s.btn(view === 'display' ? 'white' : 'transparent', view === 'display' ? '#2563eb' : '#64748b') }} disabled={!activeCompId}><Monitor size={16}/> SCHERM</button>
                </div>
            </header>

            <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                {view === 'management' && (
                    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', textAlign: 'center', paddingTop: '4rem' }}>
                        <h1 style={{ fontWeight: 900 }}>Beheer Module</h1>
                        <p style={{ color: '#64748b' }}>Selecteer een wedstrijd om te starten.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
                            {competitions.map(c => (
                                <div key={c.id} style={{ ...s.card, padding: '1.5rem', cursor: 'pointer' }} onClick={() => setActiveCompId(c.id)}>
                                    <h3 style={{ margin: 0 }}>{c.name}</h3>
                                    <p style={{ fontSize: '13px', color: '#64748b' }}>{c.date}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'live' && activeCompId && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                        
                        {/* Header voor Live Modus */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
                                <button onClick={() => setActiveTab('speed')} style={s.tab(activeTab === 'speed')}>SPEED</button>
                                <button onClick={() => setActiveTab('freestyle')} style={s.tab(activeTab === 'freestyle')}>FREESTYLE</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>HUIDIGE REEKS</div>
                                    <div style={{ fontSize: '20px', fontWeight: 900 }}>{currentHeatData?.reeks || '-'} / {activeTab === 'speed' ? speedHeats.length : freestyleHeats.length}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => updateCurrentHeat(activeTab, -1)} style={{ ...s.btn('#f1f5f9', '#475569') }}><SkipBack size={18}/></button>
                                    <button onClick={() => updateCurrentHeat(activeTab, 1)} style={{ ...s.btn('#f1f5f9', '#475569') }}><SkipForward size={18}/></button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', flex: 1 }}>
                            
                            {/* Linkerkant: Deelnemers Overzicht */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ ...s.card, flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                        <h2 style={{ margin: 0, fontWeight: 900, fontSize: '24px' }}>
                                            {activeTab === 'speed' ? 'Speed Reeks' : 'Freestyle Reeks'} {currentHeatData?.reeks}
                                        </h2>
                                        {currentHeatData?.status === 'voltooid' && (
                                            <span style={s.badge('#16a34a')}>✓ DEZE REEKS IS AFGEROND</span>
                                        )}
                                    </div>

                                    {/* Velden Lijst */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                                        {[1, 2, 3, 4, 5].map(v => {
                                            const slot = currentHeatData?.slots?.find(s => parseInt(s.veld) === v || s.veldNr === v);
                                            const sk = skippers[slot?.skipperId];
                                            
                                            return (
                                                <div key={v} style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    padding: '1.5rem', 
                                                    borderRadius: '12px', 
                                                    background: sk ? '#f8fafc' : '#f1f5f9',
                                                    border: sk ? '2px solid #e2e8f0' : '2px dashed #cbd5e1',
                                                    opacity: currentHeatData?.status === 'voltooid' ? 0.6 : 1
                                                }}>
                                                    <div style={{ width: '80px', fontSize: '14px', fontWeight: 900, color: '#94a3b8' }}>VELD {v}</div>
                                                    {sk ? (
                                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <div style={{ fontSize: '22px', fontWeight: 800 }}>{sk.naam}</div>
                                                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>{sk.club}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                                <button style={s.btn('#f1f5f9', '#64748b')}><Volume2 size={18}/> Muziek</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ flex: 1, fontStyle: 'italic', color: '#94a3b8', fontWeight: 600 }}>
                                                            Geen deelnemer op dit veld
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Actieknop onderaan de lijst */}
                                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
                                        <button 
                                            onClick={markHeatFinished}
                                            style={{ 
                                                ...s.btn('#16a34a'), 
                                                padding: '18px 60px', 
                                                fontSize: '18px',
                                                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)'
                                            }}
                                        >
                                            <CheckCircle2 size={24}/> REEKS KLAAR
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Rechterkant: Reeksen Overzicht */}
                            <div style={{ ...s.card, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900 }}>RECHTERKANT: REEKSEN</h3>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar">
                                    {(activeTab === 'speed' ? speedHeats : freestyleHeats).map(h => {
                                        const isCurrent = h.reeks === (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat);
                                        const isDone = h.status === 'voltooid';

                                        return (
                                            <div 
                                                key={h.id} 
                                                onClick={() => updateCurrentHeat(activeTab, h.reeks - (activeTab === 'speed' ? compSettings.currentSpeedHeat : compSettings.currentFreestyleHeat))}
                                                style={{ 
                                                    padding: '1rem', 
                                                    borderRadius: '12px', 
                                                    marginBottom: '0.5rem', 
                                                    cursor: 'pointer',
                                                    background: isCurrent ? '#eff6ff' : 'transparent',
                                                    border: isCurrent ? '1px solid #bfdbfe' : '1px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 800, color: isCurrent ? '#2563eb' : '#0f172a' }}>
                                                        Reeks {h.reeks}
                                                    </span>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{h.uur}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                    {isDone ? (
                                                        <>
                                                            <CheckCircle2 size={12} color="#16a34a"/>
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>KLAAR</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Circle size={12} color="#cbd5e1"/>
                                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Wachtend</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* DISPLAY VIEW (PUBLIC SCREEN) */}
                {view === 'display' && activeCompId && (
                    <div style={{ flex: 1, background: '#0f172a', margin: '-2rem', display: 'flex', flexDirection: 'column', color: 'white' }}>
                        <div style={{ padding: '3rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>{selectedComp?.name?.toUpperCase()}</div>
                                <div style={{ fontSize: '48px', fontWeight: 900 }}>{currentHeatData?.onderdeel || 'Pauze'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#94a3b8' }}>REEKS</div>
                                <div style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1 }}>{currentHeatData?.reeks || '-'}</div>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, padding: '4rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {[1, 2, 3, 4, 5].map(v => {
                                const slot = currentHeatData?.slots?.find(s => parseInt(s.veld) === v || s.veldNr === v);
                                const sk = skippers[slot?.skipperId];
                                
                                return (
                                    <div key={v} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '2.5rem', 
                                        borderRadius: '24px', 
                                        background: sk ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                                        border: sk ? '1px solid rgba(255,255,255,0.1)' : '1px dashed rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{ width: '150px', fontSize: '24px', fontWeight: 900, color: '#38bdf8' }}>VELD {v}</div>
                                        {sk ? (
                                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: '42px', fontWeight: 800 }}>{sk.naam}</div>
                                                <div style={{ fontSize: '28px', color: '#94a3b8', fontWeight: 600 }}>{sk.club}</div>
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, fontStyle: 'italic', color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>
                                                Leeg
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
