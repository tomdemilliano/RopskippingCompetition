/**
 * ManagementView.jsx — RopeScore Pro
 *
 * Beheerscherm. Orkestreert:
 *   - CompetitionList   (links)
 *   - CompetitionDetail (rechts)
 *   - Alle modals: aanmaken, bewerken, deelnemer bewerken, import
 */

import React, { useState } from 'react';
import CompetitionList   from './management/CompetitionList';
import CompetitionDetail from './management/CompetitionDetail';
import AddCompetitionModal    from './management/modals/AddCompetitionModal';
import EditCompetitionModal   from './management/modals/EditCompetitionModal';
import EditParticipantModal   from './management/modals/EditParticipantModal';
import ImportModal            from './management/modals/ImportModal';

export default function ManagementView() {
  const [selectedCompId,    setSelectedCompId]    = useState(null);
  const [showAddModal,      setShowAddModal]      = useState(false);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [importEventId,     setImportEventId]     = useState(null);
  const [editParticipant,   setEditParticipant]   = useState(null);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <CompetitionList
        selectedId={selectedCompId}
        onSelect={setSelectedCompId}
        onNewCompetition={() => setShowAddModal(true)}
      />

      <CompetitionDetail
        competitionId={selectedCompId}
        onEdit={() => setShowEditModal(true)}
        onImport={(eventId) => setImportEventId(eventId)}
        onEditParticipant={(p) => setEditParticipant(p)}
      />

      {showAddModal && (
        <AddCompetitionModal
          onClose={() => setShowAddModal(false)}
          onCreated={(id) => { setSelectedCompId(id); setShowAddModal(false); }}
        />
      )}

      {showEditModal && selectedCompId && (
        <EditCompetitionModal
          competitionId={selectedCompId}
          onClose={() => setShowEditModal(false)}
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
