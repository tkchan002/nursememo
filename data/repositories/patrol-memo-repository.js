import { DB_MODE, supabase } from '../client.js';
import { demoRead, demoWrite, uid } from '../demo-state.js';

function nowISO() { return new Date().toISOString(); }

function conflictError() {
  const error = new Error('This Night Memo was changed in another window. Reload before saving again.');
  error.code = 'PATROL_MEMO_CONFLICT';
  return error;
}

function sortRevisions(rows = []) {
  return [...rows].sort((a, b) => Number(b.revision_number || 0) - Number(a.revision_number || 0));
}

function archiveRowFromDemo(memo, revisions = []) {
  const ordered = sortRevisions(revisions);
  const latest = ordered[0] || null;
  const latestFinal = ordered.find(row => row.revision_type === 'final') || null;
  const preferred = latestFinal || latest;
  return {
    memo_id: memo.id,
    reporting_date: memo.reporting_date,
    recovery_updated_at: memo.updated_at || null,
    working_revision: Number(memo.revision || 0),
    revision_count: ordered.length,
    has_draft: ordered.some(row => row.revision_type === 'draft'),
    has_final: ordered.some(row => row.revision_type === 'final'),
    latest_revision_id: latest?.id || null,
    latest_revision_number: latest?.revision_number || null,
    latest_revision_type: latest?.revision_type || null,
    latest_revision_created_at: latest?.created_at || null,
    latest_revision_created_by_label: latest?.created_by_label || null,
    preferred_revision_id: preferred?.id || null,
    preferred_revision_number: preferred?.revision_number || null,
    preferred_revision_type: preferred?.revision_type || null,
    preferred_revision_created_at: preferred?.created_at || null,
  };
}

export async function getPatrolMemo(reportingDate) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    return (state.patrol_memos || []).find(row => row.reporting_date === reportingDate) || null;
  }
  const { data, error } = await supabase
    .from('patrol_memos')
    .select('*')
    .eq('reporting_date', reportingDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePatrolMemoRecovery({ reportingDate, document, sourceSnapshot, expectedRevision = 0 }) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    state.patrol_memos ||= [];
    const index = state.patrol_memos.findIndex(row => row.reporting_date === reportingDate);
    const current = index >= 0 ? state.patrol_memos[index] : null;
    if ((current?.revision || 0) !== Number(expectedRevision || 0)) throw conflictError();
    const now = nowISO();
    const row = {
      ...current,
      id: current?.id || uid('patrol-memo'),
      reporting_date: reportingDate,
      document,
      source_snapshot: sourceSnapshot || [],
      status: 'draft',
      revision: (current?.revision || 0) + 1,
      created_at: current?.created_at || now,
      updated_at: now,
    };
    if (index >= 0) state.patrol_memos[index] = row;
    else state.patrol_memos.push(row);
    demoWrite(state);
    return row;
  }

  const { data, error } = await supabase.rpc('save_patrol_memo_recovery', {
    p_reporting_date: reportingDate,
    p_document: document,
    p_source_snapshot: sourceSnapshot || [],
    p_expected_revision: Number(expectedRevision || 0),
  });
  if (error) throw error;
  return data;
}

export async function savePatrolMemoRevision({
  reportingDate,
  document,
  sourceSnapshot,
  expectedRevision = 0,
  revisionType,
  reason,
  actorLabel = '',
}) {
  if (!['draft', 'final'].includes(revisionType)) throw new Error('Invalid Patrol Night memo revision type.');

  if (DB_MODE === 'demo') {
    const state = demoRead();
    state.patrol_memos ||= [];
    state.patrol_memo_revisions ||= [];
    const index = state.patrol_memos.findIndex(row => row.reporting_date === reportingDate);
    const current = index >= 0 ? state.patrol_memos[index] : null;
    if ((current?.revision || 0) !== Number(expectedRevision || 0)) throw conflictError();
    const now = nowISO();
    const memo = {
      ...current,
      id: current?.id || uid('patrol-memo'),
      reporting_date: reportingDate,
      document,
      source_snapshot: sourceSnapshot || [],
      status: 'draft',
      revision: (current?.revision || 0) + 1,
      created_at: current?.created_at || now,
      updated_at: now,
      finalized_at: revisionType === 'final' ? now : current?.finalized_at || null,
    };
    if (index >= 0) state.patrol_memos[index] = memo;
    else state.patrol_memos.push(memo);
    const nextNumber = state.patrol_memo_revisions
      .filter(row => row.memo_id === memo.id)
      .reduce((max, row) => Math.max(max, Number(row.revision_number || 0)), 0) + 1;
    const revision = {
      id: uid('patrol-memo-revision'),
      memo_id: memo.id,
      revision_number: nextNumber,
      revision_type: revisionType,
      reason: reason || (revisionType === 'final' ? 'print' : 'save'),
      document,
      source_snapshot: sourceSnapshot || [],
      created_at: now,
      created_by: null,
      created_by_label: actorLabel || '',
    };
    state.patrol_memo_revisions.push(revision);
    demoWrite(state);
    return { memo, revision };
  }

  const { data, error } = await supabase.rpc('save_patrol_memo_revision', {
    p_reporting_date: reportingDate,
    p_document: document,
    p_source_snapshot: sourceSnapshot || [],
    p_expected_revision: Number(expectedRevision || 0),
    p_revision_type: revisionType,
    p_reason: reason || (revisionType === 'final' ? 'print' : 'save'),
    p_actor_label: actorLabel || '',
  });
  if (error) throw error;
  return data;
}

export async function listPatrolMemoRevisions(reportingDate) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    const memo = (state.patrol_memos || []).find(row => row.reporting_date === reportingDate);
    if (!memo) return [];
    return sortRevisions((state.patrol_memo_revisions || []).filter(row => row.memo_id === memo.id));
  }
  const { data, error } = await supabase.rpc('list_patrol_memo_revisions', {
    p_reporting_date: reportingDate,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getPatrolMemoRevision(revisionId) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    return (state.patrol_memo_revisions || []).find(row => row.id === revisionId) || null;
  }
  const { data, error } = await supabase.rpc('get_patrol_memo_revision', {
    p_revision_id: revisionId,
  });
  if (error) throw error;
  return data || null;
}

export async function listPatrolMemoArchive() {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    const revisions = state.patrol_memo_revisions || [];
    return (state.patrol_memos || [])
      .map(memo => archiveRowFromDemo(memo, revisions.filter(row => row.memo_id === memo.id)))
      .sort((a, b) => String(b.reporting_date).localeCompare(String(a.reporting_date)));
  }
  const { data, error } = await supabase.rpc('list_patrol_memo_archive');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createPatrolMemoCheckpoint({ reportingDate, reason, actorLabel = '' }) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    state.patrol_memo_recovery_snapshots ||= [];
    const memo = (state.patrol_memos || []).find(row => row.reporting_date === reportingDate);
    if (!memo) return null;
    const snapshot = {
      id: uid('patrol-memo-recovery'),
      memo_id: memo.id,
      reporting_date: reportingDate,
      reason: reason || 'safety_checkpoint',
      document: memo.document,
      source_snapshot: memo.source_snapshot || [],
      working_revision: Number(memo.revision || 0),
      created_at: nowISO(),
      created_by: null,
      created_by_label: actorLabel || '',
    };
    state.patrol_memo_recovery_snapshots.push(snapshot);
    state.patrol_memo_recovery_snapshots = state.patrol_memo_recovery_snapshots
      .filter(row => row.memo_id !== memo.id)
      .concat(state.patrol_memo_recovery_snapshots.filter(row => row.memo_id === memo.id)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10));
    demoWrite(state);
    return snapshot;
  }
  const { data, error } = await supabase.rpc('checkpoint_patrol_memo', {
    p_reporting_date: reportingDate,
    p_reason: reason || 'safety_checkpoint',
    p_actor_label: actorLabel || '',
  });
  if (error) throw error;
  return data || null;
}

export async function listPatrolMemoCheckpoints(reportingDate) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    return (state.patrol_memo_recovery_snapshots || [])
      .filter(row => row.reporting_date === reportingDate)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }
  const { data, error } = await supabase.rpc('list_patrol_memo_checkpoints', {
    p_reporting_date: reportingDate,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getPatrolMemoCheckpoint(checkpointId) {
  if (DB_MODE === 'demo') {
    const state = demoRead();
    return (state.patrol_memo_recovery_snapshots || []).find(row => row.id === checkpointId) || null;
  }
  const { data, error } = await supabase.rpc('get_patrol_memo_checkpoint', {
    p_checkpoint_id: checkpointId,
  });
  if (error) throw error;
  return data || null;
}

// DOCX branch RPCs: bytes stored in PostgreSQL bytea, references retained by the
// original Patrol recovery, revision and checkpoint lifecycle.
import { bytesToBase64, base64ToBytes, assertDocxBytes, docxMetadata } from '../../documents/docx-bytes.js';

export async function getPatrolDocxBytes(documentRef) {
  const id=documentRef?.document_id;
  if (documentRef?.version!==5 || documentRef.format!=='docx' || !id) {
    throw new Error('Old HTML memo cannot be opened as DOCX. Use Start New in this demo branch.');
  }
  if (DB_MODE==='demo') {
    const row=(demoRead().patrol_memo_docx_documents||[]).find(v=>v.id===id);
    if (!row) throw new Error('DOCX content was not found.');
    return base64ToBytes(row.data);
  }
  const {data,error}=await supabase.rpc('read_patrol_memo_docx',{p_document_id:id});
  if(error)throw error;
  return base64ToBytes(data);
}

export async function savePatrolDocxRecovery({reportingDate,bytes,sourceSnapshot,expectedRevision=0}) {
  const b64=bytesToBase64(bytes);
  if(DB_MODE==='demo') {
    const state=demoRead();
    state.patrol_memo_docx_documents ||= [];
    const id=uid('docx');
    const current=(state.patrol_memos||[]).find(x=>x.reporting_date===reportingDate);
    if (Number(current?.revision||0)!==Number(expectedRevision||0)) throw conflictError();
    state.patrol_memo_docx_documents.push({id,data:b64});
    demoWrite(state);
    return savePatrolMemoRecovery({reportingDate,document:docxMetadata(id,bytes),sourceSnapshot,expectedRevision});
  }
  const {data,error}=await supabase.rpc('save_patrol_memo_recovery_docx',{
    p_reporting_date:reportingDate,p_docx_base64:b64,p_source_snapshot:sourceSnapshot||[],p_expected_revision:Number(expectedRevision||0),
  });
  if(error)throw error;
  return data;
}

export async function savePatrolDocxRevision({reportingDate,bytes,sourceSnapshot,expectedRevision=0,revisionType,reason,actorLabel=''}) {
  const b64=bytesToBase64(bytes);
  if(DB_MODE==='demo') {
    const state=demoRead();
    const current=(state.patrol_memos||[]).find(x=>x.reporting_date===reportingDate);
    if (Number(current?.revision||0)!==Number(expectedRevision||0)) throw conflictError();
    state.patrol_memo_docx_documents ||= [];
    const id=uid('docx');state.patrol_memo_docx_documents.push({id,data:b64});demoWrite(state);
    return savePatrolMemoRevision({reportingDate,document:docxMetadata(id,bytes),sourceSnapshot,expectedRevision,revisionType,reason,actorLabel});
  }
  const {data,error}=await supabase.rpc('save_patrol_memo_revision_docx',{
    p_reporting_date:reportingDate,p_docx_base64:b64,p_source_snapshot:sourceSnapshot||[],p_expected_revision:Number(expectedRevision||0),
    p_revision_type:revisionType,p_reason:reason||null,p_actor_label:actorLabel||'',
  });
  if(error)throw error;
  return data;
}
