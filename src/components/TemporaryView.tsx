import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Plus, RotateCcw } from 'lucide-react';
import {
  CapacityChange,
  ComputedRegisterSummary,
  Language,
} from '../types/register';
import { formatMbps } from '../utils/calculations';
import { UI_TEXT } from '../utils/i18n';

interface TemporaryViewProps {
  summary: ComputedRegisterSummary;
  lang: Language;
  onLogTempUpgrade: () => void;
  onRecordReturn: (tempUpgrade: CapacityChange) => void;
}

export const TemporaryView: React.FC<TemporaryViewProps> = ({
  summary,
  lang,
  onLogTempUpgrade,
  onRecordReturn,
}) => {
  const t = UI_TEXT[lang];
  const [filter, setFilter] = useState<'all' | 'open' | 'overdue' | 'returned'>('all');

  const counts = useMemo(() => {
    const open = summary.temporaryItems.filter((i) => i.isOpen).length;
    const overdue = summary.temporaryItems.filter((i) => i.isOverdue).length;
    const returned = summary.temporaryItems.filter((i) => !i.isOpen).length;
    return { open, overdue, returned };
  }, [summary.temporaryItems]);

  const filteredItems = useMemo(() => {
    return summary.temporaryItems.filter((item) => {
      if (filter === 'open') return item.isOpen;
      if (filter === 'overdue') return item.isOverdue;
      if (filter === 'returned') return !item.isOpen;
      return true;
    });
  }, [summary.temporaryItems, filter]);

  return (
    <div className="space-y-5">
      {/* Header & Rule Banner */}
      <div className="border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t.temporary.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.temporary.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onLogTempUpgrade}
            className="inline-flex items-center gap-1.5 bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t.temporary.logTempBtn}
          </button>
        </div>

        <div className="border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950 leading-relaxed">
          {t.temporary.ruleBanner}
        </div>

        {/* 3 Flat Summary Counters + Filter Segmented Control */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500">{t.temporary.openCount}: </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {counts.open}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.temporary.overdueCount}: </span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  counts.overdue > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {counts.overdue}
              </span>
            </div>
            <div>
              <span className="text-slate-500">{t.temporary.returnedCount}: </span>
              <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                {counts.returned}
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 bg-slate-100 p-1">
            {(
              [
                ['all', lang === 'bn' ? 'সব' : 'All'],
                ['open', lang === 'bn' ? 'খোলা' : 'Open'],
                ['overdue', lang === 'bn' ? 'মেয়াদ পেরিয়েছে' : 'Overdue'],
                ['returned', lang === 'bn' ? 'ফেরত সম্পন্ন' : 'Returned'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFilter(val)}
                className={`px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filter === val
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Temporary Items Table */}
      <div className="border border-slate-200 bg-white">
        {filteredItems.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-900">{t.temporary.emptyTitle}</p>
            <p className="mt-1 text-xs text-slate-500">{t.temporary.emptySubtitle}</p>
            <button
              type="button"
              onClick={onLogTempUpgrade}
              className="mt-4 inline-flex items-center gap-1.5 border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t.temporary.logTempBtn}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">{t.changes.colCode}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colLink}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colService}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colDate}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colReturnDue}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'নেওয়া (Mbps)' : 'Provisioned'}
                  </th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'ফেরত (Mbps)' : 'Returned'}
                  </th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'খোলা বাকি' : 'Open Balance'}
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t.changes.colStatus}</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">{t.changes.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr
                    key={item.change.id}
                    className={`h-12 ${item.isOverdue ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-2.5 pl-5 pr-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {item.change.changeCode}
                    </td>
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        {item.link?.circuitId} — {item.link?.name}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {item.provider?.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold whitespace-nowrap">
                      <span
                        className={
                          item.link?.service === 'NTTN' ? 'text-emerald-800' : 'text-blue-800'
                        }
                      >
                        {item.link?.service || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {item.change.effectiveDate}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                      <span
                        className={
                          item.isOverdue ? 'font-semibold text-red-700' : 'text-slate-700'
                        }
                      >
                        {item.change.returnDueDate || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-900 tabular-nums">
                      +{formatMbps(item.originalMbps)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {item.returnedMbps > 0 ? `−${formatMbps(item.returnedMbps)}` : '0'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
                      <span className={item.remainingMbps > 0 ? 'text-amber-800' : 'text-slate-400'}>
                        {formatMbps(item.remainingMbps)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {item.isOverdue ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.daysOverdue} {t.temporary.daysOverdue}
                        </span>
                      ) : item.isOpen ? (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {t.temporary.onTime}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t.temporary.returned}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                      {item.isOpen ? (
                        <button
                          type="button"
                          onClick={() => onRecordReturn(item.change)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer ${
                            item.isOverdue
                              ? 'bg-red-700 hover:bg-red-800'
                              : 'bg-slate-900 hover:bg-slate-800'
                          }`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          {t.temporary.recordReturnBtn}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">
                          {item.returnEntries[item.returnEntries.length - 1]?.effectiveDate || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
