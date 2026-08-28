/**
 * ManagementView.jsx — RopeScore Pro
 *
 * Beheerscherm, drie secties (sectionTabs):
 *   - Wedstrijden  → CompetitionsOverview (lijst) / CompetitionDetail (na selectie)
 *   - Clubs        → ClubManagement (stamdata + logo-upload)
 *   - Gebruikers   → UserManagement (rollen + rechten)
 *
 * Navigatie verloopt via lokale state (section, view + selectedCompId).
 * Modals: aanmaken, bewerken wedstrijd, deelnemer bewerken, import.
 */

import React, { useState } from 'react';
import { ChevronLeft, Trophy, Users, Building2 } from 'lucide-react';

import CompetitionsOverview  from './management/CompetitionsOverview';
import CompetitionDetail     from './management/CompetitionDetail';
import UserManagement        from './management/UserManagement';
import ClubManagement        from './management/ClubManagement';
import AddCompetitionModal   from './management/modals/AddCompetitionModal';
import EditCompetitionModal  from './management/modals/EditCompetitionModal';
import EditParticipantModal  from './management/modals/EditParticipantModal';
import ImportModal           from './management/modals/ImportModal';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // Broodkruimel-balk bovenaan het detailscherm
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0.6rem 1.5rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '4px 0',
  },
  breadcrumbSep: {
    color: '#cbd5e1',
    fontSize: '0.8rem',
  },
  breadcrumbCurrent: {
    fontSize: '0.8rem',
    color: '#475569',
    fontWeight: 600,
  },
  detailWrapper: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sectionTabs: {
    display: 'flex',
    gap: '0.4rem',
    padding: '0.6rem 1.5rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  sectionTab: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: active ? '#eff6ff' : 'transparent',
    color: active ? '#2563eb' : '#64748b',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ManagementView() {
  // 'wedstrijden' | 'gebruikers'
  const [section, setSection] = useState('wedstrijden');

  // 'overview' | 'detail'
  const [view,            setView]            = useState('overview');
  const [selectedCompId,  setSelectedCompId]  = useState(null);

  const [showAddModal,    setShowAddModal]    = useState(false);
  // editCompId is de wedstrijd die bewerkt wordt vanuit de modal
  const [editCompId,      setEditCompId]      = useState(null);
  const [importEventId,   setImportEventId]   = useState(null);
  const [editParticipant, setEditParticipant] = useState(null);

  // Navigeer naar detailscherm
  const handleSelectCompetition = (compId) => {
    setSelectedCompId(compId);
    setView('detail');
  };

  // Terug naar overzicht
  const handleBack = () => {
    setView('overview');
    setSelectedCompId(null);
  };

  // Bewerken vanuit overzicht — opent de EditModal zonder naar detail te gaan
  const handleEditFromOverview = (compId) => {
    setEditCompId(compId);
  };

  // Bewerken vanuit detail
  const handleEditFromDetail = () => {
    setEditCompId(selectedCompId);
  };

  return (
    <div style={s.wrapper}>
      {/* ── Sectie-tabs ── */}
      <div style={s.sectionTabs}>
        <button style={s.sectionTab(section === 'wedstrijden')} onClick={() => setSection('wedstrijden')}>
          <Trophy size={14} /> Wedstrijden
        </button>
        <button style={s.sectionTab(section === 'clubs')} onClick={() => setSection('clubs')}>
          <Building2 size={14} /> Clubs
        </button>
        <button style={s.sectionTab(section === 'gebruikers')} onClick={() => setSection('gebruikers')}>
          <Users size={14} /> Gebruikers
        </button>
      </div>

      {section === 'gebruikers' && <UserManagement />}
      {section === 'clubs' && <ClubManagement />}

      {/* ── OVERZICHT ── */}
      {section === 'wedstrijden' && view === 'overview' && (
        <CompetitionsOverview
          onSelectCompetition={handleSelectCompetition}
          onNewCompetition={() => setShowAddModal(true)}
          onEditCompetition={handleEditFromOverview}
        />
      )}

      {/* ── DETAIL ── */}
      {section === 'wedstrijden' && view === 'detail' && selectedCompId && (
        <>
          {/* Broodkruimel */}
          <div style={s.breadcrumb}>
            <button style={s.backBtn} onClick={handleBack}>
              <ChevronLeft size={15} />
              Alle wedstrijden
            </button>
            <span style={s.breadcrumbSep}>/</span>
            <span style={s.breadcrumbCurrent}>Wedstrijdbeheer</span>
          </div>

          {/* Detail (vult de rest van de hoogte) */}
          <div style={s.detailWrapper}>
            <CompetitionDetail
              competitionId={selectedCompId}
              onEdit={handleEditFromDetail}
              onImport={(eventId) => setImportEventId(eventId)}
              onEditParticipant={(p) => setEditParticipant(p)}
            />
          </div>
        </>
      )}

      {/* ── MODALS ── */}
      {showAddModal && (
        <AddCompetitionModal
          onClose={() => setShowAddModal(false)}
          onCreated={(id) => {
            setShowAddModal(false);
            handleSelectCompetition(id);
          }}
        />
      )}

      {editCompId && (
        <EditCompetitionModal
          competitionId={editCompId}
          onClose={() => setEditCompId(null)}
        />
      )}

      {importEventId && selectedCompId && (
        <ImportModal
          competitionId={selectedCompId}
          eventId={importEventId}
          onClose={() => setImportEventId(null)}
        />
      )}

      {editParticipant && selectedCompId && (
        <EditParticipantModal
          competitionId={selectedCompId}
          participant={editParticipant}
          onClose={() => setEditParticipant(null)}
        />
      )}
    </div>
  );
}
