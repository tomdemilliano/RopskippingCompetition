import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, doc, collection, onSnapshot, updateDoc, writeBatch, setDoc, addDoc, query 
} from 'firebase/firestore';
import { 
    getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { Layout, Users, Play, Monitor, Plus, Calendar, MapPin, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

// Firebase configuratie
const firebaseConfig = {
    apiKey: "", // Wordt door omgeving ingevuld
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

    // Auth Logic (Rule 3)
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
        }, (err) => console.error(err));
        return () => unsubscribe();
    }, [user]);

    // Listen to active competition data
    useEffect(() => {
        if (!activeCompId || !user) return;
        const compRef = doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId);
        const skRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'skippers');
        const hRef = collection(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId, 'heats');

        const unsubS = onSnapshot(compRef, d => d.exists() && setCompSettings(d.data()), e => console.error(e));
        const unsubSk = onSnapshot(skRef, s => {
            const d = {}; s.forEach(doc => d[doc.id] = doc.data());
            setSkippers(d);
        }, e => console.error(e));
        const unsubH = onSnapshot(hRef, s => setHeats(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(e));

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

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-8 py-4 flex justify-between items-center border-b border-slate-200">
                <div className="flex items-center gap-10">
                    <div className="text-2xl font-black tracking-tighter flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs italic">RS</div>
                        ROPESCORE <span className="text-blue-600">PRO</span>
                    </div>
                    <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {[
                            {id: 'management', label: 'Beheer', icon: Layout},
                            {id: 'live', label: 'Live', icon: Play},
                            {id: 'display', label: 'Scherm', icon: Monitor}
                        ].map(v => (
                            <button 
                                key={v.id} 
                                onClick={() => setView(v.id)} 
                                className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition ${view === v.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                <v.icon size={14} />
                                {v.label.toUpperCase()}
                            </button>
                        ))}
                    </nav>
                </div>
                {selectedComp && (
                    <div className="flex items-center gap-4">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            selectedComp.status === 'actief' ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-slate-100 text-slate-500'
                        }`}>
                            {selectedComp.status}
                        </div>
                        <div className="font-bold text-slate-700">{selectedComp.name}</div>
                    </div>
                )}
            </header>

            <main className="flex-1 overflow-hidden p-8">
                {view === 'management' && (
                    <div className="max-w-7xl mx-auto h-full grid grid-cols-12 gap-8">
                        {/* Sidebar */}
                        <div className="col-span-4 flex flex-col gap-6 overflow-hidden">
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 shrink-0">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Plus size={12} /> Nieuwe Wedstrijd
                                </h3>
                                <form onSubmit={handleCreateComp} className="space-y-3">
                                    <input required placeholder="Wedstrijdnaam" className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none rounded-xl p-3 text-sm transition" value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input placeholder="Locatie" className="bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none rounded-xl p-3 text-sm transition" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} />
                                        <input type="date" className="bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white outline-none rounded-xl p-3 text-xs transition" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
                                    </div>
                                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-blue-200">AANMAKEN</button>
                                </form>
                            </div>

                            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alle Wedstrijden</h3>
                                    <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-black">{competitions.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {competitions.map(c => (
                                        <div 
                                            key={c.id} 
                                            onClick={() => setActiveCompId(c.id)} 
                                            className={`p-6 border-b border-slate-50 cursor-pointer transition-all ${activeCompId === c.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`font-black text-lg ${activeCompId === c.id ? 'text-blue-700' : 'text-slate-800'}`}>{c.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                <span className="flex items-center gap-1"><MapPin size={10}/> {c.location}</span>
                                                <span className="flex items-center gap-1"><Calendar size={10}/> {c.date}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="col-span-8 flex flex-col gap-8 overflow-hidden">
                            {selectedComp ? (
                                <>
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="bg-blue-600 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-100">
                                            <div className="text-[10px] font-black opacity-60 uppercase mb-3">Status Beheren</div>
                                            <div className="flex flex-wrap gap-2">
                                                {['gepland', 'actief', 'afgesloten'].map(s => (
                                                    <button key={s} onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'competitions', activeCompId), {status: s})} 
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition ${selectedComp.status === s ? 'bg-white text-blue-600' : 'border-white/20 hover:bg-white/10'}`}>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-[2rem] p-6 border border-slate-200">
                                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-2"><Play size={10} className="text-blue-600"/> Speed Reeksen</div>
                                            <div className="text-5xl font-black text-slate-900">{stats.speed}</div>
                                        </div>
                                        <div className="bg-white rounded-[2rem] p-6 border border-slate-200">
                                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center gap-2"><Users size={10} className="text-purple-600"/> Freestyle</div>
                                            <div className="text-5xl font-black text-slate-900">{stats.freestyle}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2rem] p-8 flex-1 flex flex-col overflow-hidden border border-slate-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-black flex items-center gap-3">
                                                <Upload className="text-blue-600" />
                                                CSV Import
                                            </h2>
                                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                                <button onClick={() => setImportType('speed')} className={`px-4 py-2 rounded-lg text-xs font-black transition ${importType === 'speed' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>SPEED</button>
                                                <button onClick={() => setImportType('freestyle')} className={`px-4 py-2 rounded-lg text-xs font-black transition ${importType === 'freestyle' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>FREESTYLE</button>
                                            </div>
                                        </div>
                                        <textarea 
                                            value={csvInput} 
                                            onChange={e => setCsvInput(e.target.value)} 
                                            placeholder={`Plak ${importType} CSV data hier... (Reeks,Onderdeel,Uur,Club,Naam...)`} 
                                            className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-mono text-xs focus:bg-white focus:border-blue-600 outline-none transition mb-4 resize-none"
                                        />
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-slate-400 font-bold">Zorg dat de kolommen exact overeenkomen met het format.</p>
                                            <button onClick={handleImport} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition">IMPORTEREN</button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                                        <Layout size={40} />
                                    </div>
                                    <p className="font-black text-slate-300 uppercase tracking-widest text-sm">Selecteer een wedstrijd in de lijst</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {view === 'live' && selectedComp && (
                    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
                        <div className="flex justify-center border-b border-slate-200">
                            <button onClick={() => setActiveTab('speed')} className={`px-8 py-4 font-black text-sm tracking-widest border-b-4 transition ${activeTab === 'speed' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>SPEED</button>
                            <button onClick={() => setActiveTab('freestyle')} className={`px-8 py-4 font-black text-sm tracking-widest border-b-4 transition ${activeTab === 'freestyle' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400'}`}>FREESTYLE</button>
                        </div>

                        <div className="bg-white rounded-[3rem] p-10 text-center flex flex-col items-center shadow-xl shadow-slate-200/50 border border-slate-100">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Huidige Actieve Reeks</span>
                            <div className="flex items-center gap-12">
                                <button onClick={() => updateHeat(-1)} className="w-14 h-14 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition text-slate-400"><ChevronLeft size={24}/></button>
                                <span className="text-8xl font-black text-slate-900 tabular-nums tracking-tighter">{(activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1))}</span>
                                <button onClick={() => updateHeat(1)} className="w-14 h-14 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition text-slate-400"><ChevronRight size={24}/></button>
                            </div>
                            <div className="mt-6">
                                <div className="text-2xl font-black text-blue-600 uppercase tracking-tight">{currentHeat?.onderdeel || 'Geen reeks'}</div>
                                <div className="text-slate-400 font-black text-sm mt-1 tracking-widest flex items-center justify-center gap-2">
                                    <Calendar size={12}/> {currentHeat?.uur || '--:--'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 overflow-y-auto pb-10 pr-2">
                            {activeTab === 'speed' ? (
                                Array.from({length: 10}).map((_, i) => {
                                    const vNum = i + 1;
                                    const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                                    const sk = slot ? skippers[slot.skipperId] : null;
                                    return (
                                        <div key={vNum} className={`bg-white p-5 rounded-2xl flex items-center gap-6 border-2 transition ${!sk ? 'opacity-20 border-transparent bg-slate-50' : 'border-slate-100 hover:border-blue-200'}`}>
                                            <div className="w-20 font-black text-blue-600 text-xs italic">VELD {vNum}</div>
                                            <div className="flex-1 font-black text-lg">{sk?.naam || 'Leeg'}</div>
                                            <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{sk?.club || ''}</div>
                                        </div>
                                    );
                                })
                            ) : (
                                currentHeat?.slots?.map((slot, i) => (
                                    <div key={i} className="bg-white p-8 rounded-[2rem] flex items-center gap-8 border-2 border-purple-50 shadow-sm">
                                        <div className="w-24 font-black text-purple-600 text-lg uppercase italic">{slot.veld}</div>
                                        <div className="flex-1 font-black text-3xl">{skippers[slot.skipperId]?.naam}</div>
                                        <div className="text-slate-400 font-black text-sm uppercase tracking-widest">{skippers[slot.skipperId]?.club}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {view === 'display' && (
                    <div className="fixed inset-0 bg-white z-[100] flex flex-col p-16 overflow-hidden">
                        <div className="flex justify-between items-end mb-16">
                            <div>
                                <h1 className="text-9xl font-black tracking-tighter leading-none mb-6">{currentHeat?.onderdeel?.toUpperCase() || 'OFFLINE'}</h1>
                                <div className="flex items-center gap-4 text-blue-600 font-black text-3xl">
                                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-ping" />
                                    LIVE WEDSTRIJD • {selectedComp?.name?.toUpperCase()}
                                </div>
                            </div>
                            <div className="flex gap-8">
                                <div className="bg-slate-100 rounded-[3rem] px-12 py-8 text-right">
                                    <div className="text-lg font-black text-slate-400 uppercase tracking-widest mb-1">Tijd</div>
                                    <div className="text-6xl font-black tracking-tight">{currentHeat?.uur || '--:--'}</div>
                                </div>
                                <div className="bg-black rounded-[3rem] px-12 py-8 text-white text-right">
                                    <div className="text-lg font-black text-white/40 uppercase tracking-widest mb-1">Reeks</div>
                                    <div className="text-6xl font-black tracking-tight tabular-nums">{(activeTab === 'speed' ? (compSettings.currentSpeedHeat || 1) : (compSettings.currentFreestyleHeat || 1))}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 gap-3 overflow-hidden">
                            {activeTab === 'speed' ? (
                                Array.from({length: 10}).map((_, i) => {
                                    const vNum = i + 1;
                                    const slot = currentHeat?.slots?.find(s => s.veldNr === vNum);
                                    const sk = slot ? skippers[slot.skipperId] : null;
                                    return (
                                        <div key={vNum} className={`flex-1 flex items-center px-16 border-4 rounded-[3rem] transition-all duration-500 ${sk ? 'bg-white border-slate-100 translate-x-0 opacity-100' : 'bg-slate-50 border-transparent opacity-5 translate-x-10'}`}>
                                            <span className="w-48 text-2xl font-black text-blue-600 italic">VELD {vNum}</span>
                                            <span className="flex-1 text-5xl font-black">{sk?.naam || ''}</span>
                                            <span className="text-3xl font-black text-slate-200 uppercase tracking-tighter">{sk?.club || ''}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                currentHeat?.slots?.map((slot, i) => (
                                    <div key={i} className="flex-1 flex items-center px-24 bg-white border-8 border-slate-50 rounded-[4rem] shadow-sm">
                                        <span className="w-56 text-5xl font-black text-purple-600 italic uppercase">{slot.veld}</span>
                                        <span className="flex-1 text-9xl font-black tracking-tighter leading-none">{skippers[slot.skipperId]?.naam}</span>
                                        <span className="text-5xl font-black text-slate-200 uppercase italic tracking-tighter">{skippers[slot.skipperId]?.club}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <button onClick={() => setView('live')} className="absolute bottom-8 left-8 opacity-0 hover:opacity-100 text-[10px] font-black uppercase tracking-widest text-slate-300">Exit Display Mode</button>
                    </div>
                )}
            </main>
        </div>
    );
}
