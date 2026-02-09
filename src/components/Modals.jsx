import React from 'react';
import { X, RotateCcw, UserMinus } from 'lucide-react';
import { styles } from '../styles';
import { COMPETITION_TYPES } from '../constants';

const Modals = ({
  // Upload Modal Props
  showUploadModal, setShowUploadModal, csvInput, setCsvInput, handleUploadCsv,
  
  // Edit Participant Modal Props
  showEditParticipantModal, setShowEditParticipantModal, editParticipantData, 
  setEditParticipantData, handleUpdateParticipant, selectedComp,
  
  // Add Competition Modal Props
  showAddCompModal, setShowAddCompModal, newComp, setNewComp, handleCreateComp,
  
  // Edit Competition Modal Props
  showEditCompModal, setShowEditCompModal, editCompData, setEditCompData, handleUpdateComp
}) => {
  return (
    <>
      {/* --- Upload CSV Modal --- */}
      {showUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '650px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Laden voor: {showUploadModal}</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowUploadModal(null)} />
            </div>
            <textarea 
              style={{ ...styles.input, height: '250px', fontFamily: 'monospace', fontSize: '0.75rem' }} 
              value={csvInput} 
              onChange={e => setCsvInput(e.target.value)} 
              placeholder="Plak hier de CSV inhoud..." 
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1, justifyContent: 'center' }} onClick={handleUploadCsv}>Importeren</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowUploadModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Edit Participant Modal --- */}
      {showEditParticipantModal && editParticipantData && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Deelnemer aanpassen</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowEditParticipantModal(null)} />
            </div>
            
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
            <input style={styles.input} value={editParticipantData.naam} onChange={e => setEditParticipantData({...editParticipantData, naam: e.target.value})} />
            
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Club</label>
            <input style={styles.input} value={editParticipantData.club} onChange={e => setEditParticipantData({...editParticipantData, club: e.target.value})} />

            <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Onderdelen & Planning</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedComp?.events.filter(ev => editParticipantData.events?.includes(ev)).map(ev => {
                  const eventKey = ev.replace(/\s/g, '');
                  const detail = editParticipantData[`detail_${eventKey}`] || {};
                  const isEventGeschrapt = editParticipantData.eventStatus?.[ev] === 'geschrapt';
                  
                  return (
                    <div key={ev} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '8px', 
                      background: isEventGeschrapt ? '#fee2e2' : '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isEventGeschrapt ? '#fecaca' : '#e2e8f0'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', textDecoration: isEventGeschrapt ? 'line-through' : 'none' }}>{ev}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Reeks {editParticipantData[`reeks_${eventKey}`] || '-'} | Veld {detail.veld || '-'} | {detail.uur || '--:--'}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          const currentStatus = { ...(editParticipantData.eventStatus || {}) };
                          currentStatus[ev] = isEventGeschrapt ? 'actief' : 'geschrapt';
                          setEditParticipantData({ ...editParticipantData, eventStatus: currentStatus });
                        }}
                        style={{
                          ...styles.btnSecondary,
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          background: isEventGeschrapt ? '#10b981' : '#ef4444',
                          color: '#fff',
                          border: 'none'
                        }}
                      >
                        {isEventGeschrapt ? 'Herstellen' : 'Schrappen'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1, justifyContent: 'center' }} onClick={handleUpdateParticipant}>Opslaan</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditParticipantModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add Competition Modal --- */}
      {showAddCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h3 style={{ marginTop: 0 }}>Nieuwe Wedstrijd</h3>
            
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Naam</label>
            <input style={styles.input} value={newComp.name} onChange={e => setNewComp({...newComp, name: e.target.value})} placeholder="Naam wedstrijd" />
            
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Type</label>
            <select style={styles.input} value={newComp.type} onChange={e => setNewComp({...newComp, type: e.target.value, events: COMPETITION_TYPES[e.target.value]})}>
              {Object.keys(COMPETITION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Datum</label>
                <input type="date" style={styles.input} value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Locatie</label>
                <input style={styles.input} value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} placeholder="bijv. Sporthal De Puzzel" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1, justifyContent: 'center' }} onClick={handleCreateComp}>Aanmaken</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowAddCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Edit Competition Modal --- */}
      {showEditCompModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.card, width: '450px' }}>
            <h3 style={{ marginTop: 0 }}>Wedstrijd Aanpassen</h3>
            
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

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button style={{ ...styles.btnPrimary, flex: 1, justifyContent: 'center' }} onClick={handleUpdateComp}>Opslaan</button>
              <button style={{ ...styles.btnSecondary, flex: 1 }} onClick={() => setShowEditCompModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Modals;
