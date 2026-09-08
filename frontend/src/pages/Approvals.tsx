import { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import Panel from '../components/ui/Panel';
import DataTable, { type ColumnDef } from '../components/ui/DataTable';
import {
  listApprovals,
  updateBlockApproval,
  type ApprovalItem,
} from '../lib/apiClient';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

function fmtDateTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function Approvals() {
  const [blocks, setBlocks] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedBlock, setSelectedBlock] = useState<ApprovalItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const data = await listApprovals();
      setBlocks(data);
      if (data.length > 0 && !selectedBlock) {
        setSelectedBlock(data[0]);
      }
    } catch (err) {
      console.error('Failed loading approvals', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDecision(status: 'Approved' | 'Rejected') {
    if (!selectedBlock) return;
    setActionLoading(true);
    try {
      await updateBlockApproval(selectedBlock.id, {
        action: status.toLowerCase(),
        notes: approvalNote || (status === 'Approved' ? 'Possession authorized. Speed restriction memo to be issued.' : 'Revision requested: conflicts with rake repositioning.'),
        controller_name: 'Dy. COM (Plg) / Central Div.',
      });

      // Reload list
      await loadData();
      setSelectedBlock((prev) =>
        prev
          ? {
              ...prev,
              approval_status: status.toLowerCase() as any,
              approval_note: approvalNote,
              approved_by: 'Dy. COM (Plg) / Central Div.',
              approved_at: new Date().toISOString(),
            }
          : null
      );
      setApprovalNote('');
    } catch (err) {
      console.error('Failed submitting block approval', err);
    } finally {
      setActionLoading(false);
    }
  }

  const filteredBlocks = blocks.filter((b) => {
    if (statusFilter === 'ALL') return true;
    return b.approval_status.toLowerCase() === statusFilter.toLowerCase();
  });

  const columns: ColumnDef<ApprovalItem>[] = [
    {
      key: 'id',
      header: 'Block ID',
      width: 'w-24',
      render: (b) => <span className="font-mono font-bold text-accent">#{b.id.slice(0, 8)}</span>,
    },
    {
      key: 'section_name',
      header: 'Corridor Section',
      render: (b) => <span className="font-medium text-text-primary text-xs">{b.section_name ?? 'Corridor Section'}</span>,
    },
    {
      key: 'block_start',
      header: 'Possession Timing',
      render: (b) => (
        <span className="font-mono text-2xs text-text-secondary">
          {fmtDateTime(b.block_start)} &rarr; {b.block_end.slice(11, 16)} ({b.duration_min}m)
        </span>
      ),
    },
    {
      key: 'departments',
      header: 'Departments',
      width: 'w-32',
      render: (b) => (
        <div className="flex items-center gap-1">
          {b.departments.map((d) => (
            <span
              key={d}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                d === 'ENG'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : d === 'TRD'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}
            >
              {d}
            </span>
          ))}
          {b.is_joint_block && (
            <span className="text-[9px] font-black px-1 rounded bg-amber-400 text-slate-900 ml-1">
              JOINT
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'tasks_count',
      header: 'Tasks',
      numeric: true,
      width: 'w-20',
      render: (b) => <span className="font-mono text-xs font-semibold">{b.tasks_count}</span>,
    },
    {
      key: 'approval_status',
      header: 'Dispatch State',
      width: 'w-28',
      render: (b) => (
        <span
          className={`text-2xs font-bold px-2 py-0.5 rounded border uppercase ${
            b.approval_status === 'approved'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : b.approval_status === 'rejected'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {b.approval_status}
        </span>
      ),
    },
  ];

  return (
    <>
      <TopBar
        title="Block Dispatch &amp; Controller Approvals Desk"
        subtitle="Operational Sign-Off, Track Possession Authorization &amp; Safety Verification"
      />

      <main className="flex-1 overflow-y-auto bg-panel p-6 space-y-6">
        {/* Verification Notice */}
        <div className="bg-white border border-border rounded-lg p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                Operating Department Final Clearance Desk
              </h3>
              <p className="text-2xs text-text-secondary">
                Indian Railways Section Controllers and Chief Controllers review and authorize joint possessions before divisional greenlight.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['ALL', 'Recommended', 'Approved', 'Rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-accent text-white shadow-xs'
                    : 'bg-panel text-text-secondary border border-border hover:text-text-primary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* ── Two-Column Layout: Block Table & Detail Action Card ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Table (7 Cols) */}
          <div className="lg:col-span-7">
            <Panel
              title={
                <div className="flex items-center justify-between w-full">
                  <span>Pending &amp; Authorized Blocks ({filteredBlocks.length})</span>
                  <span className="text-2xs font-mono text-text-secondary">
                    Click row to review work orders and authorize
                  </span>
                </div>
              }
            >
              <DataTable
                columns={columns}
                rows={filteredBlocks}
                rowKey={(b) => b.id}
                loading={loading}
                emptyMessage="No blocks match the selected approval filter."
                onRowClick={(b) => setSelectedBlock(b)}
              />
            </Panel>
          </div>

          {/* Right Action & Dossier Card (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedBlock ? (
              <Panel
                title={
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono font-bold text-accent">
                      Block #{selectedBlock.id.slice(0, 8)} Dossier
                    </span>
                    <span
                      className={`text-2xs font-bold px-2 py-0.5 rounded border uppercase ${
                        selectedBlock.approval_status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selectedBlock.approval_status === 'rejected'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {selectedBlock.approval_status}
                    </span>
                  </div>
                }
              >
                <div className="space-y-4 text-xs">
                  {/* Official Controller Stamp if Approved */}
                  {selectedBlock.approval_status === 'approved' && (
                    <div className="p-3 bg-emerald-50/80 border-2 border-emerald-300 rounded-lg text-emerald-900 space-y-1 shadow-xs">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>CONTROLLER APPROVED · CLEARED FOR DISPATCH</span>
                      </div>
                      <div className="text-2xs font-mono text-emerald-800">
                        Authorized By: {selectedBlock.approved_by || 'Dy. COM (Plg) / Central Div.'}
                      </div>
                      <div className="text-2xs font-mono text-emerald-700">
                        Timestamp: {selectedBlock.approved_at ? fmtDateTime(selectedBlock.approved_at) : 'Official Authorization Recorded'}
                      </div>
                      {selectedBlock.approval_note && (
                        <div className="text-2xs italic pt-1 border-t border-emerald-200">
                          &ldquo;{selectedBlock.approval_note}&rdquo;
                        </div>
                      )}
                    </div>
                  )}

                  {/* Operational Details */}
                  <div className="p-3 bg-panel rounded-lg border border-border space-y-2">
                    <div className="flex justify-between font-mono">
                      <span className="text-text-secondary">Corridor Section:</span>
                      <strong className="text-text-primary">{selectedBlock.section_name ?? 'Corridor Section'}</strong>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-text-secondary">Window Start:</span>
                      <span className="text-text-primary">{fmtDateTime(selectedBlock.block_start)}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-text-secondary">Window End:</span>
                      <span className="text-text-primary">{fmtDateTime(selectedBlock.block_end)}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-text-secondary">Possession Duration:</span>
                      <strong className="text-accent">{selectedBlock.duration_min} minutes ({(selectedBlock.duration_min / 60).toFixed(1)} hrs)</strong>
                    </div>
                  </div>

                  {/* Included Tasks Checklist */}
                  <div className="space-y-2">
                    <h4 className="text-2xs font-bold text-text-secondary uppercase tracking-wider">
                      Work Orders Included ({selectedBlock.tasks.length})
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedBlock.tasks.map((t) => (
                        <div
                          key={t.task_code}
                          className="p-2 bg-white rounded border border-border flex items-center justify-between text-2xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold font-mono">
                              <span className="text-accent">{t.task_code}</span>
                              <span
                                className={`text-[9px] px-1 rounded ${
                                  t.dept === 'ENG'
                                    ? 'bg-blue-100 text-blue-800'
                                    : t.dept === 'TRD'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {t.dept}
                              </span>
                            </div>
                            <div className="text-text-secondary">{t.type}</div>
                          </div>
                          <span className="font-mono text-text-primary">Pri: {t.priority?.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Controller Authorization Form */}
                  <div className="pt-3 border-t border-border space-y-2.5">
                    <label className="text-2xs font-bold text-text-secondary uppercase tracking-wider block">
                      Controller Endorsement / Restriction Memo:
                    </label>
                    <textarea
                      rows={2}
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="Add dispatch conditions, speed restrictions, or revision notes..."
                      className="w-full text-xs p-2.5 rounded border border-border bg-white text-text-primary focus:outline-none focus:border-accent"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleDecision('Approved')}
                        disabled={actionLoading || selectedBlock.approval_status === 'approved'}
                        className="py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Authorize Possession
                      </button>
                      <button
                        onClick={() => handleDecision('Rejected')}
                        disabled={actionLoading}
                        className="py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-border flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                        Flag Revision
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
            ) : (
              <div className="p-12 text-center text-text-secondary text-xs bg-white rounded-lg border border-border">
                Select a block from the table to view work orders and issue formal possession authorization.
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
