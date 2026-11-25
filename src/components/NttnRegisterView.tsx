import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  History,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
} from 'lucide-react';
import {
  CapacityChange,
  ChangeType,
  ComputedRegisterSummary,
  Language,
  NetworkLink,
  RegisterData,
} from '../types/register';
import {
  formatDateDMY,
  formatGbps,
  formatMbps,
  toDisplaySerial,
} from '../utils/calculations';
import { exportNttnReportXlsx } from '../utils/exportUtils';
import { UI_TEXT } from '../utils/i18n';

interface NttnRegisterViewProps {
  data: RegisterData;
  summary: ComputedRegisterSummary;
  lang: Language;
  onAddNttnLink: () => void;
  onEditLink: (link: NetworkLink) => void;
  onQuickChangeForLink: (linkId: string, type: ChangeType) => void;
  onEditChange: (change: CapacityChange) => void;
  onQuickComplete: (changeId: string) => void;
  onRecordReturn: (tempUpgrade: CapacityChange) => void;
  onOpenDispatchReport: (channel: 'print' | 'whatsapp' | 'email') => void;
}

export const NttnRegisterView: React.FC<NttnRegisterViewProps> = ({
  data,
  summary,
  lang,
  onAddNttnLink,
  onEditLink,
  onQuickChangeForLink,
  onEditChange,
  onQuickComplete,
  onRecordReturn,
  onOpenDispatchReport,
}) => {
  const t = UI_TEXT[lang];
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<'all' | 'changed' | 'temp'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [expandAllHistory, setExpandAllHistory] = useState(false);

  const provMap = useMemo(
    () => new Map(data.providers.map((p) => [p.id, p])),
    [data.providers]
  );

  const nttnProviders = useMemo(
    () => data.providers.filter((p) => p.category === 'NTTN'),
    [data.providers]
  );

  const allNttnLinks = useMemo(
    () => data.links.filter((l) => l.service === 'NTTN'),
    [data.links]
  );

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allNttnLinks.filter((lnk) => {
      const state = summary.linkStates[lnk.id];
      const prov = provMap.get(lnk.providerId);
      if (providerFilter !== 'ALL' && lnk.providerId !== providerFilter) return false;
      if (modeFilter === 'changed' && (!state || state.history.length === 0)) return false;
      if (modeFilter === 'temp' && (!state || state.openTempCount === 0)) return false;
      if (q) {
        const hay = [
          lnk.circuitId,
          lnk.providerLinkId || '',
          lnk.customerName || '',
          lnk.popLocation || lnk.name,
          lnk.statusNote || '',
          prov?.name || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allNttnLinks, summary.linkStates, provMap, providerFilter, modeFilter, search]);

  const filteredTotals = useMemo(() => {
    let totalCurrent = 0;
    let totalInitial = 0;
    let activeCount = 0;
    let changedLinkCount = 0;
    filteredLinks.forEach((lnk) => {
      const st = summary.linkStates[lnk.id];
      if (lnk.active) {
        activeCount += 1;
        totalInitial += lnk.initialMbps;
        totalCurrent += st ? st.currentMbps : lnk.initialMbps;
      }
      if (st && st.history.length > 0) changedLinkCount += 1;
    });
    return { totalCurrent, totalInitial, activeCount, changedLinkCount };
  }, [filteredLinks, summary.linkStates]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAllHistory = () => {
    const next = !expandAllHistory;
    setExpandAllHistory(next);
    if (next) {
      const map: Record<string, boolean> = {};
      filteredLinks.forEach((l) => {
        const st = summary.linkStates[l.id];
        if (st && st.history.length > 0) map[l.id] = true;
      });
      setExpandedIds(map);
    } else {
      setExpandedIds({});
    }
  };

  return (
    <div className="space-y-5">
      {/* Print-only Report Header */}
      <div className="hidden print-only border-b border-slate-900 pb-3 mb-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold text-slate-900">
            SpeedNet — {t.nttn.title}
          </h1>
          <div className="font-mono text-xs text-slate-700">
            {t.topbar.asOfDate}: {formatDateDMY(summary.asOfDate)} · {t.nttn.totalLabel}:{' '}
            {formatMbps(filteredTotals.totalCurrent)} Mbps ({toDisplaySerial(filteredTotals.activeCount, lang)}
            {t.nttn.linksSuffix})
          </div>
        </div>
      </div>

      {/* Top Summary & Controls Panel */}
      <div className="border border-slate-200 bg-white p-5 space-y-4 no-print">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t.nttn.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.nttn.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAddNttnLink}
              className="inline-flex items-center gap-1.5 bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t.nttn.addNttnLink}
            </button>
            <button
              type="button"
              onClick={() => exportNttnReportXlsx(data, summary)}
              className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              {t.nttn.exportNttnExcel}
            </button>
            <button
              type="button"
              onClick={() => onOpenDispatchReport('whatsapp')}
              className="inline-flex items-center gap-1.5 border border-emerald-300 bg-emerald-50/70 px-3.5 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {lang === 'bn' ? 'Email / WhatsApp পাঠান' : 'Send Email / WhatsApp'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
              {t.nttn.printNttn}
            </button>
          </div>
        </div>

        {/* Provider Quick Breakdown Strip */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <div className="border border-slate-200 bg-emerald-50/40 px-4 py-3">
            <div className="text-xs text-emerald-900 font-medium">
              {t.kpi.nttnTotal} ({formatDateDMY(summary.asOfDate)})
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-xl font-semibold text-emerald-950 tabular-nums">
                {formatMbps(summary.nttnTotalMbps)} <span className="text-xs font-normal">Mbps</span>
              </span>
              <span className="font-mono text-xs text-emerald-800 tabular-nums">
                {formatGbps(summary.nttnTotalMbps)} · {toDisplaySerial(summary.nttnLinkCount, lang)}
                {t.nttn.linksSuffix}
              </span>
            </div>
          </div>

          {summary.providerRows
            .filter((r) => r.provider.category === 'NTTN')
            .slice(0, 2)
            .map((row) => (
              <div
                key={row.provider.id}
                className="border border-slate-200 bg-slate-50/50 px-4 py-3"
              >
                <div className="text-xs text-slate-600 truncate font-medium">
                  {row.provider.name}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                    {formatMbps(row.totalMbps)} <span className="text-xs font-normal">Mbps</span>
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {toDisplaySerial(row.linkCount, lang)}
                    {t.nttn.linksSuffix}
                    {row.lastChangeDate ? ` · ${formatDateDMY(row.lastChangeDate)}` : ''}
                  </span>
                </div>
              </div>
            ))}
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'Link Key, Link ID বা এলাকা/POP খুঁজুন...'
                    : 'Search Link Key, Link ID, or Area/POP...'
                }
                className="w-full border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
            >
              <option value="ALL">
                {lang === 'bn' ? 'সব NTTN Provider' : 'All NTTN Providers'}
              </option>
              {nttnProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-1">
              {(
                [
                  ['all', t.nttn.allLinks],
                  ['changed', t.nttn.changedOnly],
                  ['temp', t.nttn.openTempOnly],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModeFilter(id)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    modeFilter === id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleAllHistory}
            className="inline-flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <History className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {expandAllHistory
              ? lang === 'bn'
                ? 'সব ইতিহাস বন্ধ করুন'
                : 'Collapse All History'
              : lang === 'bn'
              ? 'পরিবর্তনের ইতিহাস খুলুন'
              : 'Expand Changed History'}
          </button>
        </div>
      </div>

      {/* Exact NTTN Link Report Table */}
      <section className="border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-700">
                <th className="py-2.5 pl-4 pr-2 text-center whitespace-nowrap w-12">
                  {t.nttn.colSerial}
                </th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colLinkKey}</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colProvider}</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colService}</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colLinkId}</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colRoute}</th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colStartDate}</th>
                <th className="px-2.5 py-2.5 text-right whitespace-nowrap">
                  {t.nttn.colCapacity}
                </th>
                <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colStatusNote}</th>
                <th className="py-2.5 pl-2.5 pr-4 text-right whitespace-nowrap no-print">
                  {t.nttn.colActions}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredLinks.map((lnk, idx) => {
                const prov = provMap.get(lnk.providerId);
                const state = summary.linkStates[lnk.id];
                const currentMbps = state ? state.currentMbps : lnk.initialMbps;
                const netDelta = state ? state.netChangeMbps : 0;
                const historyCount = state ? state.history.length : 0;
                const isExpanded = Boolean(expandedIds[lnk.id]);
                const hasOverdue = (state?.overdueTempCount || 0) > 0;
                const hasOpenTemp = (state?.openTempCount || 0) > 0;

                return (
                  <React.Fragment key={lnk.id}>
                    <tr
                      className={`min-h-11 transition-colors ${
                        hasOverdue
                          ? 'bg-red-50/40'
                          : isExpanded
                          ? 'bg-slate-50/90'
                          : 'hover:bg-slate-50/70'
                      } ${!lnk.active ? 'opacity-60' : ''}`}
                    >
                      {/* ক্রম */}
                      <td className="py-2.5 pl-4 pr-2 text-center font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {toDisplaySerial(idx + 1, lang)}
                      </td>

                      {/* Link Key */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleExpand(lnk.id)}
                          className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-900 hover:text-blue-700 cursor-pointer"
                          title={t.nttn.changeHistoryTitle}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400 no-print" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 no-print" />
                          )}
                          {lnk.circuitId}
                        </button>
                      </td>

                      {/* Provider */}
                      <td className="px-2.5 py-2.5 text-xs text-slate-700 whitespace-nowrap">
                        {prov?.name.replace(' (NTTN)', '') || '—'}
                      </td>

                      {/* Service */}
                      <td className="px-2.5 py-2.5 font-mono text-xs font-semibold text-emerald-800 whitespace-nowrap">
                        {lnk.service}
                      </td>

                      {/* Link ID */}
                      <td className="px-2.5 py-2.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {lnk.providerLinkId || '—'}
                      </td>

                      {/* এলাকা / POP (রুট) ও গ্রাহক */}
                      <td className="px-2.5 py-2.5 text-xs font-medium text-slate-900 min-w-[200px]">
                        {lnk.customerName ? (
                          <div>
                            <div className="font-semibold text-slate-900">{lnk.customerName}</div>
                            <div className="text-[11px] text-slate-500">
                              {lnk.popLocation || lnk.name}
                            </div>
                          </div>
                        ) : (
                          lnk.popLocation || lnk.name
                        )}
                      </td>

                      {/* শুরুর তারিখ */}
                      <td className="px-2.5 py-2.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateDMY(lnk.startDate)}
                      </td>

                      {/* ক্যাপাসিটি (Mbps) */}
                      <td className="px-2.5 py-2.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            currentMbps < 0 ? 'text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {formatMbps(currentMbps)}
                        </div>
                        {netDelta !== 0 && (
                          <div
                            className={`text-[11px] ${
                              netDelta > 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {formatMbps(lnk.initialMbps)} → {netDelta > 0 ? '+' : '−'}
                            {formatMbps(Math.abs(netDelta))}
                          </div>
                        )}
                      </td>

                      {/* নোট / স্ট্যাটাস */}
                      <td className="px-2.5 py-2.5 text-xs text-slate-700 min-w-[165px]">
                        <div className="font-medium text-slate-800">
                          {lnk.statusNote || (lnk.active ? 'Active' : 'Inactive')}
                        </div>
                        {state?.lastChangeDate && (
                          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {lang === 'bn' ? 'সর্বশেষ:' : 'Last:'}{' '}
                            {formatDateDMY(state.lastChangeDate)}
                          </div>
                        )}
                        {hasOpenTemp && (
                          <div
                            className={`text-[11px] font-medium ${
                              hasOverdue ? 'text-red-700' : 'text-amber-800'
                            }`}
                          >
                            Temp: +{formatMbps(state.openTempMbps)} Mbps
                            {hasOverdue
                              ? lang === 'bn'
                                ? ' (মেয়াদ শেষ)'
                                : ' (Overdue)'
                              : ''}
                          </div>
                        )}
                      </td>

                      {/* Direct Actions: Upgrade / Downgrade / Temp / History / Edit */}
                      <td className="py-2 pl-2.5 pr-4 text-right whitespace-nowrap no-print">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onQuickChangeForLink(lnk.id, 'Upgrade')}
                            title={t.nttn.upgradeBtn}
                            className="inline-flex items-center gap-0.5 border border-emerald-200 bg-emerald-50/70 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            {t.nttn.upgradeBtn}
                          </button>

                          <button
                            type="button"
                            onClick={() => onQuickChangeForLink(lnk.id, 'Downgrade')}
                            title={t.nttn.downgradeBtn}
                            className="inline-flex items-center gap-0.5 border border-red-200 bg-red-50/70 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-100 transition-colors cursor-pointer"
                          >
                            <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                            {t.nttn.downgradeBtn}
                          </button>

                          <button
                            type="button"
                            onClick={() => onQuickChangeForLink(lnk.id, 'Temporary Upgrade')}
                            title={t.nttn.tempBtn}
                            className="inline-flex items-center gap-0.5 border border-amber-200 bg-amber-50/70 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {t.nttn.tempBtn}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleExpand(lnk.id)}
                            title={t.nttn.changeHistoryTitle}
                            className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                              isExpanded
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : historyCount > 0
                                ? 'border-blue-200 bg-blue-50/70 text-blue-800 hover:bg-blue-100'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <History className="h-3 w-3" aria-hidden="true" />
                            <span className="font-mono tabular-nums">{historyCount}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditLink(lnk)}
                            title={t.nttn.editBtn}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            aria-label={t.nttn.editBtn}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Chronological Change History Drawer Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={10} className="px-6 py-4 border-t border-slate-200">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs text-slate-700">
                                <span className="font-semibold text-slate-900">
                                  {t.nttn.changeHistoryTitle} — {lnk.circuitId}
                                </span>
                                <span className="mx-2 text-slate-300">·</span>
                                <span className="font-mono text-slate-600">
                                  {t.nttn.initialCapLabel}: {formatMbps(lnk.initialMbps)} Mbps (
                                  {formatDateDMY(lnk.startDate)})
                                </span>
                                <span className="mx-2 text-slate-300">·</span>
                                <span className="font-mono font-semibold text-emerald-900">
                                  {lang === 'bn' ? 'বর্তমান:' : 'Current:'} {formatMbps(currentMbps)}{' '}
                                  Mbps
                                </span>
                              </div>

                              <div className="flex items-center gap-2 no-print">
                                <button
                                  type="button"
                                  onClick={() => onQuickChangeForLink(lnk.id, 'Upgrade')}
                                  className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
                                >
                                  + {t.nttn.upgradeBtn}
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => onQuickChangeForLink(lnk.id, 'Downgrade')}
                                  className="text-xs font-medium text-red-800 hover:underline cursor-pointer"
                                >
                                  − {t.nttn.downgradeBtn}
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => onQuickChangeForLink(lnk.id, 'Temporary Upgrade')}
                                  className="text-xs font-medium text-amber-900 hover:underline cursor-pointer"
                                >
                                  + {t.nttn.tempBtn}
                                </button>
                              </div>
                            </div>

                            {!state || state.history.length === 0 ? (
                              <p className="text-xs text-slate-500 py-1">{t.nttn.noChangesYet}</p>
                            ) : (
                              <div className="overflow-x-auto border border-slate-200 bg-white">
                                <table className="w-full border-collapse text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                                      <th className="py-2 pl-3 pr-2 whitespace-nowrap">
                                        {t.changes.colDate}
                                      </th>
                                      <th className="px-2 py-2 whitespace-nowrap">
                                        {t.changes.colCode}
                                      </th>
                                      <th className="px-2 py-2 whitespace-nowrap">
                                        {t.changes.colType}
                                      </th>
                                      <th className="px-2 py-2 text-right whitespace-nowrap">
                                        {lang === 'bn' ? 'পূর্বের → নতুন (Mbps)' : 'Before → After'}
                                      </th>
                                      <th className="px-2 py-2 text-right whitespace-nowrap">
                                        {t.changes.colDelta}
                                      </th>
                                      <th className="px-2 py-2 whitespace-nowrap">
                                        {t.changes.colStatus}
                                      </th>
                                      <th className="px-2 py-2 whitespace-nowrap">
                                        {t.changes.colReturnDue}
                                      </th>
                                      <th className="px-2 py-2 whitespace-nowrap">
                                        {t.changes.colRef}
                                      </th>
                                      <th className="py-2 pl-2 pr-3 text-right whitespace-nowrap no-print">
                                        {t.changes.colActions}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {/* Baseline Row */}
                                    <tr className="bg-slate-50/40 text-slate-500">
                                      <td className="py-2 pl-3 pr-2 font-mono tabular-nums whitespace-nowrap">
                                        {formatDateDMY(lnk.startDate)}
                                      </td>
                                      <td className="px-2 py-2 font-mono">INIT</td>
                                      <td className="px-2 py-2">
                                        {t.nttn.initialCapLabel}
                                      </td>
                                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-800 font-medium">
                                        {formatMbps(lnk.initialMbps)} Mbps
                                      </td>
                                      <td className="px-2 py-2 text-right font-mono">—</td>
                                      <td className="px-2 py-2">Baseline</td>
                                      <td className="px-2 py-2">—</td>
                                      <td className="px-2 py-2">{lnk.providerLinkId || '—'}</td>
                                      <td className="py-2 pl-2 pr-3 text-right no-print">—</td>
                                    </tr>

                                    {/* Chronological Change Rows */}
                                    {state.history.map((h) => {
                                      const isPos = h.signedDelta >= 0;
                                      return (
                                        <tr key={h.change.id} className="hover:bg-slate-50">
                                          <td className="py-2 pl-3 pr-2 font-mono font-medium text-slate-800 tabular-nums whitespace-nowrap">
                                            {formatDateDMY(h.change.effectiveDate)}
                                          </td>
                                          <td className="px-2 py-2 font-mono text-slate-600 whitespace-nowrap">
                                            {h.change.changeCode}
                                          </td>
                                          <td className="px-2 py-2 font-medium text-slate-800 whitespace-nowrap">
                                            {h.change.changeType}
                                          </td>
                                          <td className="px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                                            {h.change.status === 'Completed' ? (
                                              <>
                                                {formatMbps(h.beforeMbps)} →{' '}
                                                <strong className="text-slate-900">
                                                  {formatMbps(h.afterMbps)}
                                                </strong>
                                              </>
                                            ) : (
                                              <span className="text-slate-400">
                                                ({h.change.status})
                                              </span>
                                            )}
                                          </td>
                                          <td
                                            className={`px-2 py-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                                              h.change.status !== 'Completed'
                                                ? 'text-slate-400 line-through'
                                                : isPos
                                                ? 'text-emerald-700'
                                                : 'text-red-700'
                                            }`}
                                          >
                                            {isPos ? '+' : '−'}
                                            {formatMbps(Math.abs(h.signedDelta))}
                                          </td>
                                          <td className="px-2 py-2 whitespace-nowrap">
                                            <span
                                              className={
                                                h.change.status === 'Completed'
                                                  ? 'font-semibold text-emerald-800'
                                                  : h.change.status === 'Requested'
                                                  ? 'font-semibold text-amber-700'
                                                  : 'text-slate-400'
                                              }
                                            >
                                              {h.change.status}
                                            </span>
                                          </td>
                                          <td className="px-2 py-2 font-mono tabular-nums whitespace-nowrap">
                                            {h.change.returnDueDate ? (
                                              <span
                                                className={
                                                  h.isOverdueTemp
                                                    ? 'font-semibold text-red-700'
                                                    : 'text-slate-600'
                                                }
                                              >
                                                {formatDateDMY(h.change.returnDueDate)}
                                              </span>
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td className="px-2 py-2 text-slate-600 max-w-[240px] truncate">
                                            {h.change.referenceNo ? `${h.change.referenceNo} · ` : ''}
                                            {h.change.remarks || '—'}
                                          </td>
                                          <td className="py-2 pl-2 pr-3 text-right whitespace-nowrap no-print">
                                            <div className="inline-flex items-center gap-1.5">
                                              {h.change.status === 'Requested' && (
                                                <button
                                                  type="button"
                                                  onClick={() => onQuickComplete(h.change.id)}
                                                  className="inline-flex items-center gap-0.5 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                                                >
                                                  <Check className="h-3 w-3" />
                                                  {t.changes.markCompleted}
                                                </button>
                                              )}
                                              {h.isOpenTemp && (
                                                <button
                                                  type="button"
                                                  onClick={() => onRecordReturn(h.change)}
                                                  className="inline-flex items-center gap-0.5 border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                                                >
                                                  <RotateCcw className="h-3 w-3" />
                                                  {t.changes.recordReturn}
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => onEditChange(h.change)}
                                                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                                                aria-label={t.changes.edit}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </button>
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
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Exact Footer Total Row matching user's format */}
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-emerald-50/50 text-xs font-bold text-slate-900">
                <td className="py-3 pl-4 pr-2 text-center">{t.nttn.totalLabel}</td>
                <td className="px-2.5 py-3" colSpan={6}>
                  <span className="font-normal text-slate-600">
                    {lang === 'bn'
                      ? `হিসাবের তারিখ: ${formatDateDMY(summary.asOfDate)} পর্যন্ত স্বয়ংক্রিয় যোগফল`
                      : `Auto-computed total as of ${formatDateDMY(summary.asOfDate)}`}
                  </span>
                </td>
                <td className="px-2.5 py-3 text-right font-mono text-sm font-bold text-emerald-950 tabular-nums whitespace-nowrap">
                  {formatMbps(filteredTotals.totalCurrent)} Mbps
                </td>
                <td className="px-2.5 py-3 font-semibold text-emerald-950 whitespace-nowrap">
                  {toDisplaySerial(filteredTotals.activeCount, lang)}
                  {t.nttn.linksSuffix}
                </td>
                <td className="py-3 pl-2.5 pr-4 text-right font-mono text-xs font-normal text-slate-500 no-print">
                  {formatGbps(filteredTotals.totalCurrent)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};
