import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  CapacityChange,
  ChangeStatus,
  ChangeType,
  ComputedRegisterSummary,
  Language,
  ProviderCategory,
  RegisterData,
} from '../types/register';
import { formatMbps, getSignedDelta } from '../utils/calculations';
import { UI_TEXT } from '../utils/i18n';

interface ChangesViewProps {
  data: RegisterData;
  summary: ComputedRegisterSummary;
  lang: Language;
  initialProviderFilter?: string;
  initialStatusFilter?: ChangeStatus | 'ALL';
  onAddChange: () => void;
  onEditChange: (change: CapacityChange) => void;
  onDeleteChange: (changeId: string) => void;
  onQuickComplete: (changeId: string) => void;
  onRecordReturn: (tempUpgrade: CapacityChange) => void;
}

export const ChangesView: React.FC<ChangesViewProps> = ({
  data,
  summary,
  lang,
  initialProviderFilter = 'ALL',
  initialStatusFilter = 'ALL',
  onAddChange,
  onEditChange,
  onDeleteChange,
  onQuickComplete,
  onRecordReturn,
}) => {
  const t = UI_TEXT[lang];
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProviderCategory | 'ALL'>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>(initialProviderFilter);
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | 'ALL'>(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState<ChangeType | 'ALL'>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const linkMap = useMemo(() => new Map(data.links.map((l) => [l.id, l])), [data.links]);
  const provMap = useMemo(() => new Map(data.providers.map((p) => [p.id, p])), [data.providers]);
  const openTempMap = useMemo(() => {
    const map = new Map<string, { remaining: number; isOverdue: boolean }>();
    summary.temporaryItems.forEach((item) => {
      if (item.isOpen) {
        map.set(item.change.id, { remaining: item.remainingMbps, isOverdue: item.isOverdue });
      }
    });
    return map;
  }, [summary.temporaryItems]);

  const errorIds = useMemo(() => {
    const set = new Set<string>();
    summary.issues.filter((i) => i.scope === 'completed').forEach((i) => set.add(i.entityId));
    return set;
  }, [summary.issues]);

  const filteredChanges = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...data.changes]
      .sort(
        (a, b) =>
          b.effectiveDate.localeCompare(a.effectiveDate) ||
          b.changeCode.localeCompare(a.changeCode)
      )
      .filter((chg) => {
        const link = linkMap.get(chg.linkId);
        const prov = link ? provMap.get(link.providerId) : undefined;
        if (categoryFilter !== 'ALL' && prov?.category !== categoryFilter) return false;
        if (providerFilter !== 'ALL' && prov?.id !== providerFilter) return false;
        if (statusFilter !== 'ALL' && chg.status !== statusFilter) return false;
        if (typeFilter !== 'ALL' && chg.changeType !== typeFilter) return false;
        if (q) {
          const hay = [
            chg.changeCode,
            chg.referenceNo || '',
            chg.remarks || '',
            link?.circuitId || '',
            link?.providerLinkId || '',
            link?.popLocation || '',
            link?.name || '',
            link?.service || '',
            prov?.name || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [
    data.changes,
    linkMap,
    provMap,
    categoryFilter,
    providerFilter,
    statusFilter,
    typeFilter,
    search,
  ]);

  // Separate totals for filtered Completed rows
  const filteredStats = useMemo(() => {
    let upNet = 0;
    let nttnNet = 0;
    let completedCount = 0;
    filteredChanges.forEach((c) => {
      if (c.status !== 'Completed') return;
      completedCount += 1;
      const link = linkMap.get(c.linkId);
      const delta = getSignedDelta(c.changeType, c.amountMbps);
      if (link?.service === 'NTTN') nttnNet += delta;
      else upNet += delta;
    });
    return { upNet, nttnNet, completedCount };
  }, [filteredChanges, linkMap]);

  return (
    <div className="space-y-5">
      {/* Header & Filter Toolbar */}
      <div className="border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t.changes.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.changes.subtitle}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600">
            <span>
              Upstream Net:{' '}
              <strong
                className={
                  filteredStats.upNet > 0
                    ? 'text-emerald-700'
                    : filteredStats.upNet < 0
                    ? 'text-red-700'
                    : 'text-slate-900'
                }
              >
                {filteredStats.upNet >= 0 ? '+' : ''}
                {formatMbps(filteredStats.upNet)} Mbps
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              NTTN Net:{' '}
              <strong
                className={
                  filteredStats.nttnNet > 0
                    ? 'text-emerald-700'
                    : filteredStats.nttnNet < 0
                    ? 'text-red-700'
                    : 'text-slate-900'
                }
              >
                {filteredStats.nttnNet >= 0 ? '+' : ''}
                {formatMbps(filteredStats.nttnNet)} Mbps
              </strong>
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.changes.searchPlaceholder}
              className="w-full border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ProviderCategory | 'ALL')}
            className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
          >
            <option value="ALL">{t.changes.allCategories}</option>
            <option value="Upstream">Upstream (IIG/Content)</option>
            <option value="NTTN">NTTN (Transmission)</option>
          </select>

          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
          >
            <option value="ALL">All Providers</option>
            {data.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ChangeType | 'ALL')}
            className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
          >
            <option value="ALL">{t.changes.allTypes}</option>
            <option value="Upgrade">Upgrade (+)</option>
            <option value="Downgrade">Downgrade (−)</option>
            <option value="Temporary Upgrade">Temporary Upgrade (+)</option>
            <option value="Temporary Return">Temporary Return (−)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ChangeStatus | 'ALL')}
            className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
          >
            <option value="ALL">{t.changes.allStatuses}</option>
            <option value="Completed">Completed</option>
            <option value="Requested">Requested</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 bg-white">
        {filteredChanges.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-900">{t.changes.emptyTitle}</p>
            <p className="mt-1 text-xs text-slate-500">{t.changes.emptySubtitle}</p>
            <button
              type="button"
              onClick={onAddChange}
              className="mt-4 inline-flex items-center gap-1.5 bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t.changes.addFirst}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">{t.changes.colCode}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colDate}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colLink}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colService}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colType}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t.changes.colDelta}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colStatus}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colReturnDue}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colRef}</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">{t.changes.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChanges.map((chg) => {
                  const link = linkMap.get(chg.linkId);
                  const prov = link ? provMap.get(link.providerId) : undefined;
                  const signedDelta = getSignedDelta(chg.changeType, chg.amountMbps);
                  const isPositive = signedDelta >= 0;
                  const openTemp = openTempMap.get(chg.id);
                  const hasError = errorIds.has(chg.id);
                  const isFuture =
                    chg.status === 'Completed' && chg.effectiveDate > summary.asOfDate;

                  return (
                    <tr
                      key={chg.id}
                      className={`min-h-11 transition-colors hover:bg-slate-50 ${
                        hasError ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-5 pr-3 font-mono text-xs font-medium text-slate-800 whitespace-nowrap">
                        {chg.changeCode}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <div>{chg.effectiveDate}</div>
                        {isFuture && (
                          <div className="text-[11px] text-amber-700">
                            {lang === 'bn' ? 'তারিখের পর কার্যকর' : 'After as-of date'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px]">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {link ? `${link.circuitId} — ${link.name}` : 'Missing Link'}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {prov?.name || 'Unknown Provider'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <span
                          className={`font-mono font-semibold ${
                            link?.service === 'NTTN' ? 'text-emerald-800' : 'text-blue-800'
                          }`}
                        >
                          {link?.service || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {isPositive ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                          )}
                          {chg.changeType}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                          chg.status !== 'Completed'
                            ? 'text-slate-400 line-through decoration-slate-300'
                            : isPositive
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {isPositive ? '+' : '−'}
                        {formatMbps(Math.abs(signedDelta))}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <span
                          className={
                            chg.status === 'Completed'
                              ? 'font-semibold text-emerald-800'
                              : chg.status === 'Requested'
                              ? 'font-semibold text-amber-700'
                              : 'font-medium text-slate-400'
                          }
                        >
                          {chg.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                        {chg.returnDueDate ? (
                          <span
                            className={
                              openTemp?.isOverdue
                                ? 'font-semibold text-red-700'
                                : 'text-slate-600'
                            }
                          >
                            {chg.returnDueDate}
                            {openTemp?.isOverdue
                              ? lang === 'bn'
                                ? ' (মেয়াদ শেষ)'
                                : ' (Overdue)'
                              : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px] text-xs text-slate-600">
                        <div className="truncate font-mono text-[11px] text-slate-700">
                          {chg.referenceNo || '—'}
                        </div>
                        {chg.remarks && (
                          <div className="truncate text-[11px] text-slate-500" title={chg.remarks}>
                            {chg.remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {chg.status === 'Requested' && (
                            <button
                              type="button"
                              onClick={() => onQuickComplete(chg.id)}
                              title={t.changes.markCompleted}
                              className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              <Check className="h-3 w-3" aria-hidden="true" />
                              {t.changes.markCompleted}
                            </button>
                          )}
                          {openTemp && (
                            <button
                              type="button"
                              onClick={() => onRecordReturn(chg)}
                              title={t.changes.recordReturn}
                              className="inline-flex items-center gap-1 border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              {t.changes.recordReturn}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditChange(chg)}
                            title={t.changes.edit}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            aria-label={t.changes.edit}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {confirmDeleteId === chg.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteChange(chg.id);
                                setConfirmDeleteId(null);
                              }}
                              onBlur={() => setConfirmDeleteId(null)}
                              className="bg-red-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-800 cursor-pointer"
                            >
                              {lang === 'bn' ? 'নিশ্চিত?' : 'Confirm?'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(chg.id)}
                              title={t.changes.delete}
                              className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                              aria-label={t.changes.delete}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
