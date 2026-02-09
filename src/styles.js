export const styles = {
    mainWrapper: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif' },
    header: { height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
    layoutGrid: { flex: 1, display: 'grid', gridTemplateColumns: '260px 280px 1fr', overflow: 'hidden' },
    column: { background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    contentArea: { padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
    card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.75rem' },
    btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
    btnSecondary: { background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' },
    btnDanger: { background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' },
    btnSuccess: { background: '#f0fdf4', color: '#10b981', border: '1px solid #bbf7d0', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' },
    input: { width: '100%', padding: '0.6rem', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    csvExample: { background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.65rem', color: '#475569', marginBottom: '0.5rem', border: '1px dashed #cbd5e1', overflowX: 'auto', whiteSpace: 'nowrap' },
    badgeLive: { background: '#ef4444', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, animation: 'pulse 2s infinite' },
    badgeDone: { background: '#94a3b8', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 900 },
    
    liveGrid: { display: 'grid', gridTemplateColumns: '300px 1fr', height: '100%', overflow: 'hidden' },
    liveLeft: { background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
    liveContent: { padding: '1.5rem', overflowY: 'auto', background: '#f8fafc' },
    reeksNav: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    timerBox: { background: '#1e293b', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold' },

    filterBtn: { 
      padding: '0.4rem 0.8rem', 
      borderRadius: '6px', 
      fontSize: '0.75rem', 
      border: '1px solid #e2e8f0', 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '6px',
      background: '#fff',
      color: '#64748b',
      fontWeight: 'bold',
      transition: 'all 0.2s'
    }
  };
