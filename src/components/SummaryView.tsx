import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Info,
  Send,
} from 'lucide-react';
import {
  ALL_SERVICES,
  ComputedRegisterSummary,
  Language,
  ServiceType,
} from '../types/register';
import { formatGbps, formatMbps } from '../utils/calculations';
import { MONTH_LABELS, UI_TEXT } from '../utils/i18n';

interface SummaryViewProps {
  summary: ComputedRegisterSummary;
  lang: Language;
  onInspectProvider: (providerId: string) => void;
  onOpenTemporaryTab: () => void;
  onOpenChangesTab: (filterStatus?: 'Requested' | 'Completed') => void;
  onOpenSetupTab: () => void;
  onOpenDispatchReport: (channel: 'print' | 'whatsapp' | 'email') => void;
}

const SERVICE_BAR_COLORS: Record<ServiceType, string> = {
  IIG: 'bg-blue-700',
  GGC: 'bg-sky-600',
  FNA: 'bg-indigo-600',
  BDIX: 'bg-teal-600',
  CDN: 'bg-cyan-600',
  bCDN: 'bg-slate-600',
  PNI: 'bg-violet-600',
  NTTN: 'bg-emerald-700',
  Other: 'bg-slate-400',
};

export const SummaryView: React.FC<SummaryViewProps> = ({
  summary,
  lang,
  onInspectProvider,
  onOpenTemporaryTab,
  onOpenChangesTab,
  onOpenSetupTab,
  onOpenDispatchReport,
}) => {
  const t = UI_TEXT[lang];
  const months = MONTH_LABELS[lang];
  const [showIssuesDrawer, setShowIssuesDrawer] = useState(false);

  const hasAuditErrors =
    summary.setupIncompleteCount > 0 || summary.completedErrorsCount > 0;
  const hasOverdue = summary.overdueTempTotalCount > 0;

  const upstreamServices = summary.serviceRows.filter((s) => s.category === 'Upstream');
  const nttnService = summary.serviceRows.find((s) => s.service === 'NTTN');

  const maxMonthlyMagnitude = Math.max(
    1,
    ...summary.monthlyMovements.map((m) =>
      Math.max(
        m.upstreamUpgrade + m.upstreamTempUp,
        m.upstreamDowngrade + m.upstreamTempReturn,
        m.nttnUpgrade + m.nttnTempUp,
        m.nttnDowngrade + m.nttnTempReturn
      )
    )
  );

  const totalYearCompleted = summary.monthlyMovements.reduce(
    (acc, m) => acc + m.completedCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Separation Policy Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
          <p className="leading-snug">{t.rules.separationNotice}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
          <span>
            {t.topbar.asOfDate}: <strong className="text-slate-900">{summary.asOfDate}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t.topbar.reportYear}: <strong className="text-slate-900">{summary.reportYear}</strong>
          </span>
        </div>
      </div>

      {/* Red Alert Banner (only shown if errors or overdue returns exist) */}
      {(hasAuditErrors || hasOverdue) && (
        <div className="border border-red-200 bg-red-50/70 px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t.rules.redAlertWarning}</p>
                <p className="mt-0.5 text-xs text-red-800">
                  {t.kpi.setupIncomplete}: <span className="font-mono font-semibold tabular-nums">{summary.setupIncompleteCount}</span>
                  {' · '}
                  {t.kpi.completedErrors}: <span className="font-mono font-semibold tabular-nums">{summary.completedErrorsCount}</span>
                  {' · '}
                  {t.kpi.overdueLabel}: <span className="font-mono font-semibold tabular-nums">{summary.overdueTempTotalCount}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasAuditErrors && (
                <button
                  type="button"
                  onClick={() => setShowIssuesDrawer((prev) => !prev)}
                  className="px-3 py-1.5 text-xs font-medium text-red-900 bg-white border border-red-300 hover:bg-red-100/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.summary.viewAuditIssues} ({summary.issues.length})
                </button>
              )}
              {hasOverdue && (
                <button
                  type="button"
                  onClick={onOpenTemporaryTab}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.nav.temporary}
                </button>
              )}
            </div>
          </div>

          {showIssuesDrawer && summary.issues.length > 0 && (
            <ul className="mt-3 divide-y divide-red-200/70 border-t border-red-200 pt-2 text-xs text-red-900">
              {summary.issues.map((issue) => (
                <li key={issue.id} className="flex items-center justify-between gap-4 py-1.5">
                  <span>
                    <span className="font-mono font-semibold">{issue.scope === 'setup' ? 'SETUP' : 'COMPLETED'}</span>
                    {' · '}
                    {lang === 'bn' ? issue.messageBn : issue.messageEn}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      issue.scope === 'setup' ? onOpenSetupTab() : onOpenChangesTab('Completed')
                    }
                    className="font-medium underline hover:text-red-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {issue.scope === 'setup' ? t.nav.setup : t.nav.changes}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 4-Column Executive KPI Strip — Strict Upstream vs NTTN Separation */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Upstream Bandwidth Total */}
        <div className="border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{t.kpi.upstreamTotal}</span>
            <span className="font-mono tabular-nums text-slate-600">
              {summary.upstreamLinkCount} {t.kpi.linksUnit}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatMbps(summary.upstreamTotalMbps)}
            </span>
            <span className="text-xs font-medium text-slate-500">Mbps</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono tabular-nums text-blue-700 font-medium">
              {formatGbps(summary.upstreamTotalMbps)}
            </span>
            <span className="font-mono tabular-nums">
              {summary.reportYear} Net:{' '}
              <span
                className={
                  summary.ytdUpstreamNet > 0
                    ? 'text-emerald-700 font-medium'
                    : summary.ytdUpstreamNet < 0
                    ? 'text-red-700 font-medium'
                    : 'text-slate-600'
                }
              >
                {summary.ytdUpstreamNet >= 0 ? '+' : ''}
                {formatMbps(summary.ytdUpstreamNet)}
              </span>
            </span>
          </div>
        </div>

        {/* KPI 2: NTTN Transmission Total (Strictly Separate) */}
        <div className="border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{t.kpi.nttnTotal}</span>
            <span className="font-mono tabular-nums text-slate-600">
              {summary.nttnLinkCount} {t.kpi.linksUnit}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatMbps(summary.nttnTotalMbps)}
            </span>
            <span className="text-xs font-medium text-slate-500">Mbps</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono tabular-nums text-emerald-700 font-medium">
              {formatGbps(summary.nttnTotalMbps)}
            </span>
            <span className="font-mono tabular-nums">
              {summary.reportYear} Net:{' '}
              <span
                className={
                  summary.ytdNttnNet > 0
                    ? 'text-emerald-700 font-medium'
                    : summary.ytdNttnNet < 0
                    ? 'text-red-700 font-medium'
                    : 'text-slate-600'
                }
              >
                {summary.ytdNttnNet >= 0 ? '+' : ''}
                {formatMbps(summary.ytdNttnNet)}
              </span>
            </span>
          </div>
        </div>

        {/* KPI 3: Open Temporary & Pending Requests */}
        <div className="border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{t.kpi.openTemp}</span>
            <button
              type="button"
              onClick={onOpenTemporaryTab}
              className="text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
            >
              {t.nav.temporary}
            </button>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {summary.openTempTotalCount}
            </span>
            <span className="text-xs font-medium text-slate-500">Temporary</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span
              className={
                summary.overdueTempTotalCount > 0
                  ? 'text-red-700 font-semibold font-mono tabular-nums'
                  : 'text-slate-500 font-mono tabular-nums'
              }
            >
              {t.kpi.overdueLabel}: {summary.overdueTempTotalCount}
            </span>
            <button
              type="button"
              onClick={() => onOpenChangesTab('Requested')}
              className="text-slate-600 hover:text-blue-700 font-mono tabular-nums cursor-pointer"
            >
              {t.kpi.pendingLabel}: {summary.pendingRequestsCount}
            </button>
          </div>
        </div>

        {/* KPI 4: Register Audit Integrity */}
        <div className="border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{t.kpi.auditHealth}</span>
            {!hasAuditErrors ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {summary.setupIncompleteCount + summary.completedErrorsCount}
              </span>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5">
            <div>
              <div className="text-xs text-slate-500">{t.kpi.setupIncomplete}</div>
              <div
                className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${
                  summary.setupIncompleteCount > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {summary.setupIncompleteCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">{t.kpi.completedErrors}</div>
              <div
                className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${
                  summary.completedErrorsCount > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {summary.completedErrorsCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Provider-wise Current Capacity Matrix */}
      <section className="border border-slate-200 bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {t.summary.providerMatrixTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t.summary.providerMatrixSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Mbps · {summary.providerRows.length} Providers
            </span>
            <button
              type="button"
              onClick={() => onOpenDispatchReport('print')}
              className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              {lang === 'bn' ? 'Print / Email / WhatsApp' : 'Print / Email / WhatsApp'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">{t.summary.colProvider}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t.summary.colType}</th>
                {ALL_SERVICES.map((svc) => (
                  <th
                    key={svc}
                    className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                      svc === 'NTTN'
                        ? 'border-l border-slate-200 bg-emerald-50/40 text-emerald-900'
                        : ''
                    }`}
                  >
                    {svc}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-l border-slate-200">
                  {t.summary.colLinks}
                </th>
                <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                  {t.summary.colLastChange}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.providerRows.map((row) => {
                const isNttn = row.provider.category === 'NTTN';
                return (
                  <tr
                    key={row.provider.id}
                    onClick={() => onInspectProvider(row.provider.id)}
                    className="group h-11 cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="py-2 pl-5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 group-hover:text-blue-700">
                        {row.provider.name}
                        <ChevronRight
                          className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-700"
                          aria-hidden="true"
                        />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <span
                        className={
                          isNttn
                            ? 'font-medium text-emerald-800'
                            : 'font-medium text-blue-800'
                        }
                      >
                        {row.provider.category}
                      </span>
                    </td>
                    {ALL_SERVICES.map((svc) => {
                      const val = row.byService[svc];
                      const isNttnCol = svc === 'NTTN';
                      return (
                        <td
                          key={svc}
                          className={`px-3 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                            isNttnCol ? 'border-l border-slate-200 bg-emerald-50/20' : ''
                          } ${
                            val > 0
                              ? isNttnCol
                                ? 'font-semibold text-emerald-950'
                                : 'font-semibold text-slate-900'
                              : 'text-slate-300'
                          }`}
                        >
                          {val > 0 ? formatMbps(val) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-xs font-medium text-slate-700 tabular-nums border-l border-slate-200">
                      {row.linkCount}
                    </td>
                    <td className="py-2 pl-3 pr-5 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {row.lastChangeDate || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {/* Upstream Subtotal Row */}
              <tr className="border-t border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900">
                <td className="py-2.5 pl-5 pr-3" colSpan={2}>
                  {t.summary.subtotalUpstream}
                </td>
                {ALL_SERVICES.map((svc) => {
                  const sRow = summary.serviceRows.find((r) => r.service === svc);
                  const val = svc === 'NTTN' ? 0 : sRow?.currentMbps || 0;
                  return (
                    <td
                      key={svc}
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        svc === 'NTTN'
                          ? 'border-l border-slate-200 text-slate-300'
                          : val > 0
                          ? 'text-blue-900'
                          : 'text-slate-300'
                      }`}
                    >
                      {svc === 'NTTN' ? '—' : val > 0 ? formatMbps(val) : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-mono tabular-nums border-l border-slate-200 text-blue-900">
                  {summary.upstreamLinkCount}
                </td>
                <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums text-blue-900 whitespace-nowrap">
                  {formatMbps(summary.upstreamTotalMbps)} Mbps
                </td>
              </tr>

              {/* NTTN Subtotal Row (Explicitly Separate!) */}
              <tr className="border-t border-slate-200 bg-emerald-50/40 text-xs font-semibold text-emerald-950">
                <td className="py-2.5 pl-5 pr-3" colSpan={2}>
                  {t.summary.subtotalNttn}
                </td>
                {ALL_SERVICES.map((svc) => {
                  const val = svc === 'NTTN' ? summary.nttnTotalMbps : 0;
                  return (
                    <td
                      key={svc}
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        svc === 'NTTN'
                          ? 'border-l border-slate-200 text-emerald-950'
                          : 'text-slate-300'
                      }`}
                    >
                      {svc === 'NTTN' ? formatMbps(val) : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-mono tabular-nums border-l border-slate-200 text-emerald-950">
                  {summary.nttnLinkCount}
                </td>
                <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums text-emerald-950 whitespace-nowrap">
                  {formatMbps(summary.nttnTotalMbps)} Mbps
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Section 2: Two-Column Grid — Service Totals Table + Visual Distribution & Monthly Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left 6 cols: Service-wise Totals ("সেবা অনুযায়ী মোট") */}
        <section className="border border-slate-200 bg-white lg:col-span-6">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              {t.summary.serviceTotalsTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t.summary.serviceTotalsSubtitle}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pl-5 pr-3">{t.summary.colService}</th>
                  <th className="px-3 py-2.5 text-right">{t.summary.colCurrentMbps}</th>
                  <th className="px-3 py-2.5 text-right">{t.summary.colShare}</th>
                  <th className="px-3 py-2.5 text-right">{t.summary.colOpenTemp}</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">{t.summary.colOverdue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upstreamServices.map((s) => (
                  <tr key={s.service} className="h-10 hover:bg-slate-50/80">
                    <td className="py-2 pl-5 pr-3 font-medium text-slate-900">
                      <span className="font-mono text-xs font-semibold">{s.service}</span>
                      <span className="ml-2 text-xs text-slate-400">Upstream</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {s.currentMbps > 0 ? formatMbps(s.currentMbps) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-500 tabular-nums">
                      {s.currentMbps > 0 ? `${s.sharePercent.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {s.openTempCount}
                    </td>
                    <td
                      className={`py-2 pl-3 pr-5 text-right font-mono text-xs tabular-nums ${
                        s.overdueTempCount > 0
                          ? 'font-semibold text-red-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {s.overdueTempCount}
                    </td>
                  </tr>
                ))}

                {/* Upstream Subtotal */}
                <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-blue-950">
                  <td className="py-2.5 pl-5 pr-3">{t.summary.subtotalUpstream}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatMbps(summary.upstreamTotalMbps)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">100.0%</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {upstreamServices.reduce((a, b) => a + b.openTempCount, 0)}
                  </td>
                  <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums">
                    {upstreamServices.reduce((a, b) => a + b.overdueTempCount, 0)}
                  </td>
                </tr>

                {/* NTTN Separate Row */}
                {nttnService && (
                  <tr className="border-t-2 border-slate-300 bg-emerald-50/40 text-xs font-semibold text-emerald-950">
                    <td className="py-3 pl-5 pr-3">
                      <span className="font-mono font-semibold">NTTN</span>
                      <span className="ml-2 font-normal text-emerald-800">
                        {lang === 'bn' ? '(আলাদা ট্রান্সমিশন)' : '(Separate Transmission)'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatMbps(nttnService.currentMbps)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">100.0%</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {nttnService.openTempCount}
                    </td>
                    <td
                      className={`py-3 pl-3 pr-5 text-right font-mono tabular-nums ${
                        nttnService.overdueTempCount > 0 ? 'text-red-700' : ''
                      }`}
                    >
                      {nttnService.overdueTempCount}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right 6 cols: Upstream Composition Bar + Monthly Upgrade/Downgrade Chart */}
        <div className="space-y-6 lg:col-span-6">
          {/* Upstream Bandwidth Composition */}
          <section className="border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {lang === 'bn'
                  ? 'Upstream ব্যান্ডউইথ বিন্যাস'
                  : 'Upstream Bandwidth Mix'}
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {formatMbps(summary.upstreamTotalMbps)} Mbps
              </span>
            </div>

            {/* Segmented Horizontal Bar */}
            <div className="mt-3 flex h-3 w-full overflow-hidden bg-slate-100">
              {upstreamServices
                .filter((s) => s.currentMbps > 0)
                .map((s) => (
                  <div
                    key={s.service}
                    style={{ width: `${s.sharePercent}%` }}
                    title={`${s.service}: ${formatMbps(s.currentMbps)} Mbps (${s.sharePercent.toFixed(1)}%)`}
                    className={`${SERVICE_BAR_COLORS[s.service]} h-full transition-opacity hover:opacity-85`}
                  />
                ))}
            </div>

            {/* Clean Typographic Legend */}
            <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {upstreamServices
                .filter((s) => s.currentMbps > 0)
                .map((s) => (
                  <div key={s.service} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 ${SERVICE_BAR_COLORS[s.service]}`}
                        aria-hidden="true"
                      />
                      <span className="font-mono font-medium">{s.service}</span>
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {s.sharePercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </section>

          {/* Monthly Upgradation vs Downgradation Activity */}
          <section className="border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {t.summary.monthlyTrendTitle} ({summary.reportYear})
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.summary.monthlyTrendSubtitle}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'বৃদ্ধি (+)' : 'Upgrade (+)'}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'হ্রাস (−)' : 'Downgrade (−)'}</span>
                </span>
              </div>
            </div>

            {totalYearCompleted === 0 ? (
              <div className="mt-6 py-8 text-center text-xs text-slate-500 border-t border-slate-100">
                {t.summary.noChangesInYear}
              </div>
            ) : (
              <div className="mt-5">
                <div className="grid grid-cols-12 items-end gap-1.5 h-36 border-b border-slate-200 pb-2">
                  {summary.monthlyMovements.map((m) => {
                    const totalUp =
                      m.upstreamUpgrade + m.upstreamTempUp + m.nttnUpgrade + m.nttnTempUp;
                    const totalDown =
                      m.upstreamDowngrade +
                      m.upstreamTempReturn +
                      m.nttnDowngrade +
                      m.nttnTempReturn;
                    const upPct = totalUp > 0 ? Math.max(8, (totalUp / maxMonthlyMagnitude) * 100) : 0;
                    const downPct =
                      totalDown > 0 ? Math.max(8, (totalDown / maxMonthlyMagnitude) * 100) : 0;

                    return (
                      <div
                        key={m.monthKey}
                        className="flex h-full flex-col items-center justify-end gap-1"
                        title={`${months[m.monthIndex]} ${summary.reportYear}: +${formatMbps(totalUp)} Mbps / −${formatMbps(totalDown)} Mbps`}
                      >
                        <div className="flex h-full w-full items-end justify-center gap-0.5">
                          <div
                            className="w-2.5 bg-emerald-600 transition-all"
                            style={{ height: `${upPct}%` }}
                          />
                          <div
                            className="w-2.5 bg-red-600 transition-all"
                            style={{ height: `${downPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 grid grid-cols-12 gap-1.5 text-center text-[11px] text-slate-500">
                  {summary.monthlyMovements.map((m) => (
                    <span key={m.monthKey} className="truncate">
                      {months[m.monthIndex]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Operational Usage Guide (from original spreadsheet notes) */}
          <section className="border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-800">
              {lang === 'bn' ? 'ব্যবহারবিধি ও নিয়মাবলি' : 'Register Operating Rules'}
            </p>
            <p>{t.rules.workflowHint}</p>
            <p>{t.rules.statusHint}</p>
          </section>
        </div>
      </div>
    </div>
  );
};
