import React from 'react';
import { X, Info, AlertTriangle } from 'lucide-react';
import { styles } from '../styles';
import { COMPETITION_TYPES } from '../constants';

const Modals = ({
  showUploadModal, setShowUploadModal,
  showAddCompModal, setShowAddCompModal,
  showEditCompModal, setShowEditCompModal,
  csvInput, setCsvInput,
  handleUploadCsv,
  newComp, setNewComp,
  handleCreateComp,
  editCompData, setEditCompData,
  handleUpdateComp, 
  selectedComp, 
  showEditParticipantModal, setShowEditParticipantModal,
  editParticipantData, setEditParticipantData,
  handleUpdateParticipant  
}) => {
  
  // 1. CSV Upload Modal
  if (showUploadModal) {
    return (
      <div style={styles.modalOverlay}>
        <div style={{ ...styles.modalContent, width: '600px' }}>
          <div style={styles.modalHeader}>
            <h3>Deelnemers importeren ({showUploadModal})</h3>
            <button onClick={() => setShowUploadModal(null)} style={styles.iconBtn}><X size={20}/></button>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '0.5rem' }}>
            <Info size={16}/>
            <span>Plak CSV data met kolommen: <strong>naam, club, reeks_[onderdeel], veld_[onderdeel]</strong></span>
          </div>
          <textarea 
            style={{ ...styles.input, height: '300px', margin: '1rem 0', fontFamily: 'monospace', fontSize: '0.8rem' }}
            placeholder="naam,club,reeks_Speed,veld_Speed..."
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button style={{ ...styles.btnPrimary, flex: 1, justifyContent: 'center' }} onClick={handleUploadCsv}>Importeren</button>
            <button style={{ ...styles.btnSecondary, flex: 1, justifyContent: 'center' }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Nieuwe Wedstrijd Modal
  if (showAddCompModal) {
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3>Nieuwe Wedstrijd</h3>
            <button onClick={() => setShowAddCompModal(false)} style={styles.iconBtn}><X size={20}/></button>
          </div>
          
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
          <input style={styles.input} value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} />
          
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Type</label>
          <select style={styles.input} value={newComp.type} onChange={e => {
            const type = e.target.value;
            setNewComp({...newComp, type, events: COMPETITION_TYPES[type]});
          }}>
            {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Datum</label>
              <input type="date" style={styles.input} value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Locatie</label>
              <input style={styles.input} value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} />
            </div>
          </div>

          <button style={{ ...styles.btnPrimary, width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handleCreateComp}>Toevoegen</button>
        </div>
      </div>
    );
  }

  // 3. Bewerk Wedstrijd Modal
  if (showEditCompModal) {
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3>Wedstrijd Bewerken</h3>
            <button onClick={() => setShowEditCompModal(false)} style={styles.iconBtn}><X size={20}/></button>
          </div>
          
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
          <input style={styles.input} value={editCompData.name} onChange={e => setEditCompData({...editCompData, name: e.target.value})} />
          
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Type</label>
          <select style={styles.input} value={editCompData.type} onChange={e => setEditCompData({...editCompData, type: e.target.value})}>
            {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Datum</label>
              <input type="date" style={styles.input} value={editCompData.date} onChange={e => setEditCompData({...editCompData, date: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Locatie</label>
              <input style={styles.input} value={editCompData.location} onChange={e => setEditCompData({...editCompData, location: e.target.value})} />
            </div>
          </div>

          <button style={{ ...styles.btnPrimary, width: '100%', justifyContent: 'center', marginTop: '1rem' }} onClick={handleUpdateComp}>Opslaan</button>
        </div>
      </div>
    );
  }

  // 4. Bewerk Deelnemer Modal
  if (showEditParticipantModal) {
    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h3>Deelnemer Bewerken</h3>
            <button onClick={() => setShowEditParticipantModal(null)} style={styles.iconBtn}><X size={20}/></button>
          </div>
          
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
          <input 
            style={styles.input} 
            value={editParticipantData?.naam || ''} 
            onChange={e => setEditParticipantData({...editParticipantData, naam: e.target.value})} 
          />
          
          <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Club</label>
          <input 
            style={styles.input} 
            value={editParticipantData?.club || ''} 
            onChange={e => setEditParticipantData({...editParticipantData, club: e.target.value})} 
          />

          <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>WEDSTRIJD DETAILS</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
              {selectedComp?.events.map(ev => {
                const key = ev.replace(/\s/g, '');
                return (
                  <div key={ev} style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '4px' }}>{ev}</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input 
                        placeholder="Rks"
                        style={{ ...styles.input, marginBottom: 0, padding: '2px 4px', fontSize: '0.75rem' }}
                        value={editParticipantData?.[`reeks_${key}`] || ''}
                        onChange={e => setEditParticipantData({...editParticipantData, [`reeks_${key}`]: e.target.value})}
                      />
                      <input 
                        placeholder="Veld"
                        style={{ ...styles.input, marginBottom: 0, padding: '2px 4px', fontSize: '0.75rem' }}
                        value={editParticipantData?.[`detail_${key}`]?.veld || ''}
                        onChange={e => setEditParticipantData({
                          ...editParticipantData, 
                          [`detail_${key}`]: { ...editParticipantData?.[`detail_${key}`], veld: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            style={{ ...styles.btnPrimary, width: '100%', justifyContent: 'center', marginTop: '1.5rem' }} 
            onClick={() => handleUpdateParticipant(editParticipantData.id, editParticipantData)}
          >
            Wijzigingen Opslaan
          </button>
        </div>
      </div>
    );
  }
  
  return null;
};

export default Modals;
