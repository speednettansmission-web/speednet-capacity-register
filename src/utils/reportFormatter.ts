import * as XLSX from 'xlsx';
import {
  CapacityChange,
  ComputedRegisterSummary,
  Language,
  NetworkLink,
  Provider,
  RegisterData,
  UPSTREAM_SERVICES,
} from '../types/register';
import {
  computeRegisterSummary,
  formatDateDMY,
  formatGbps,
  formatMbps,
  getSignedDelta,
  toDisplaySerial,
} from './calculations';

export type ReportFrequency = 'monthly' | 'daily';

export interface ReportScopeOptions {
  includeUpstream: boolean;
  includeNttn: boolean;
  includePeriodChanges: boolean;
  compactWhatsApp: boolean;
}

export interface PeriodChangeDetail {
  change: CapacityChange;
  link: NetworkLink | undefined;
  provider: Provider | undefined;
  signedDelta: number;
  beforeMbps: number;
  afterMbps: number;
}

export interface DispatchReportModel {
  frequency: ReportFrequency;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  periodLabelBn: string;
  periodLabelEn: string;
  summary: ComputedRegisterSummary;
  periodChanges: PeriodChangeDetail[];
  upstreamChanges: PeriodChangeDetail[];
  nttnChanges: PeriodChangeDetail[];
  changesByLinkId: Record<string, PeriodChangeDetail[]>;
  changesByProviderId: Record<string, PeriodChangeDetail[]>;
  nttnLinks: {
    link: NetworkLink;
    provider: Provider | undefined;
    currentMbps: number;
    periodChanges: PeriodChangeDetail[];
    periodNetDelta: number;
    hasOpenTemp: boolean;
    openTempMbps: number;
  }[];
}

const BN_MONTH_FULL = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const EN_MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getLastDayOfMonth(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return `${ym}-28`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
}

export function buildDispatchReport(
  data: RegisterData,
  frequency: ReportFrequency,
  monthYm: string, // YYYY-MM
  dailyYmd: string // YYYY-MM-DD
): DispatchReportModel {
  const periodStart = frequency === 'monthly' ? `${monthYm}-01` : dailyYmd;
  const periodEnd = frequency === 'monthly' ? getLastDayOfMonth(monthYm) : dailyYmd;
  const reportYear = Number(periodEnd.slice(0, 4)) || 2026;

  let periodLabelBn = formatDateDMY(dailyYmd);
  let periodLabelEn = formatDateDMY(dailyYmd);
  if (frequency === 'monthly') {
    const [yStr, mStr] = monthYm.split('-');
    const mIdx = Math.max(0, Math.min(11, (Number(mStr) || 1) - 1));
    periodLabelBn = `${BN_MONTH_FULL[mIdx]} ${yStr}`;
    periodLabelEn = `${EN_MONTH_FULL[mIdx]} ${yStr}`;
  }

  const summary = computeRegisterSummary(data, periodEnd, reportYear);
  const linkMap = new Map(data.links.map((l) => [l.id, l]));
  const provMap = new Map(data.providers.map((p) => [p.id, p]));

  // Collect all Completed changes falling within [periodStart, periodEnd]
  const periodChanges: PeriodChangeDetail[] = [];
  const changesByLinkId: Record<string, PeriodChangeDetail[]> = {};
  const changesByProviderId: Record<string, PeriodChangeDetail[]> = {};

  data.links.forEach((lnk) => {
    const state = summary.linkStates[lnk.id];
    if (!state) return;
    const prov = provMap.get(lnk.providerId);
    state.history.forEach((h) => {
      if (
        h.change.status === 'Completed' &&
        h.change.effectiveDate >= periodStart &&
        h.change.effectiveDate <= periodEnd
      ) {
        const detail: PeriodChangeDetail = {
          change: h.change,
          link: lnk,
          provider: prov,
          signedDelta: h.signedDelta,
          beforeMbps: h.beforeMbps,
          afterMbps: h.afterMbps,
        };
        periodChanges.push(detail);
        if (!changesByLinkId[lnk.id]) changesByLinkId[lnk.id] = [];
        changesByLinkId[lnk.id].push(detail);
        if (prov) {
          if (!changesByProviderId[prov.id]) changesByProviderId[prov.id] = [];
          changesByProviderId[prov.id].push(detail);
        }
      }
    });
  });

  periodChanges.sort(
    (a, b) =>
      a.change.effectiveDate.localeCompare(b.change.effectiveDate) ||
      a.change.changeCode.localeCompare(b.change.changeCode)
  );

  const upstreamChanges = periodChanges.filter((p) => p.link?.service !== 'NTTN');
  const nttnChanges = periodChanges.filter((p) => p.link?.service === 'NTTN');

  const nttnLinks = data.links
    .filter((l) => l.service === 'NTTN' && l.active)
    .map((link) => {
      const st = summary.linkStates[link.id];
      const linkPeriodChanges = changesByLinkId[link.id] || [];
      const periodNetDelta = linkPeriodChanges.reduce((acc, c) => acc + c.signedDelta, 0);
      return {
        link,
        provider: provMap.get(link.providerId),
        currentMbps: st ? st.currentMbps : link.initialMbps,
        periodChanges: linkPeriodChanges,
        periodNetDelta,
        hasOpenTemp: (st?.openTempCount || 0) > 0,
        openTempMbps: st?.openTempMbps || 0,
      };
    });

  // Unused variable guard
  void linkMap;

  return {
    frequency,
    periodStart,
    periodEnd,
    periodLabelBn,
    periodLabelEn,
    summary,
    periodChanges,
    upstreamChanges,
    nttnChanges,
    changesByLinkId,
    changesByProviderId,
    nttnLinks,
  };
}

export function formatLinkChangeSummary(
  changes: PeriodChangeDetail[],
  lang: Language
): string {
  if (changes.length === 0) {
    return lang === 'bn' ? 'কোনো পরিবর্তন নেই' : 'No Up/Down change';
  }
  return changes
    .map((c) => {
      const sign = c.signedDelta >= 0 ? '+' : '−';
      return `${c.change.changeType} ${sign}${formatMbps(Math.abs(c.signedDelta))} Mbps (${formatDateDMY(
        c.change.effectiveDate
      )})`;
    })
    .join('; ');
}

export function buildWhatsAppReportText(
  report: DispatchReportModel,
  lang: Language,
  options: ReportScopeOptions
): string {
  const isBn = lang === 'bn';
  const periodTitle = isBn ? report.periodLabelBn : report.periodLabelEn;
  const freqTitle =
    report.frequency === 'monthly'
      ? isBn
        ? 'মাসিক ক্যাপাসিটি রিপোর্ট'
        : 'Monthly Capacity Report'
      : isBn
      ? 'দৈনিক ক্যাপাসিটি রিপোর্ট'
      : 'Daily Capacity Report';

  const lines: string[] = [];
  lines.push(`*SpeedNet — ${freqTitle}*`);
  lines.push(
    isBn
      ? `সময়কাল: ${periodTitle} (হিসাবের তারিখ: ${formatDateDMY(report.periodEnd)})`
      : `Period: ${periodTitle} (As of: ${formatDateDMY(report.periodEnd)})`
  );
  lines.push('────────────────────');

  if (options.includeUpstream) {
    lines.push(
      isBn
        ? `*১. Upstream ব্যান্ডউইথ (মোট: ${formatMbps(report.summary.upstreamTotalMbps)} Mbps / ${formatGbps(
            report.summary.upstreamTotalMbps
          )})*`
        : `*1. Upstream Bandwidth (Total: ${formatMbps(report.summary.upstreamTotalMbps)} Mbps / ${formatGbps(
            report.summary.upstreamTotalMbps
          )})*`
    );

    const upProviders = report.summary.providerRows.filter(
      (r) => r.provider.category === 'Upstream'
    );
    upProviders.forEach((row) => {
      const parts = UPSTREAM_SERVICES.filter((s) => row.byService[s] > 0).map(
        (s) => `${s}: ${formatMbps(row.byService[s])}`
      );
      const provChgs = report.changesByProviderId[row.provider.id] || [];
      const chgTag =
        provChgs.length > 0
          ? ` | ${formatLinkChangeSummary(provChgs, lang)}`
          : '';
      lines.push(
        `• *${row.provider.name}*: ${formatMbps(row.totalMbps)} Mbps (${parts.join(', ')})${chgTag}`
      );
    });
    lines.push('');
  }

  if (options.includeNttn) {
    lines.push(
      isBn
        ? `*২. NTTN ট্রান্সমিশন (আলাদা হিসাব — মোট: ${formatMbps(
            report.summary.nttnTotalMbps
          )} Mbps / ${toDisplaySerial(report.nttnLinks.length, lang)}টি লিংক)*`
        : `*2. NTTN Transmission (Separate — Total: ${formatMbps(
            report.summary.nttnTotalMbps
          )} Mbps / ${report.nttnLinks.length} links)*`
    );

    const nttnProviders = report.summary.providerRows.filter(
      (r) => r.provider.category === 'NTTN'
    );
    nttnProviders.forEach((pRow) => {
      lines.push(
        `▸ *${pRow.provider.name}*: ${formatMbps(pRow.totalMbps)} Mbps (${pRow.linkCount} ${
          isBn ? 'টি লিংক' : 'links'
        })`
      );

      if (!options.compactWhatsApp) {
        const provLinks = report.nttnLinks.filter(
          (item) => item.link.providerId === pRow.provider.id
        );
        provLinks.forEach((item, idx) => {
          const customerLabel = item.link.customerName
            ? `${item.link.customerName} (${item.link.popLocation})`
            : item.link.popLocation;
          const upDownNote =
            item.periodChanges.length > 0
              ? ` — [${formatLinkChangeSummary(item.periodChanges, lang)}]`
              : '';
          lines.push(
            `  ${toDisplaySerial(idx + 1, lang)}. ${item.link.circuitId} | ${customerLabel}: *${formatMbps(
              item.currentMbps
            )} Mbps*${upDownNote}`
          );
        });
      }
    });
    lines.push('');
  }

  if (options.includePeriodChanges) {
    lines.push(
      isBn
        ? `*৩. এই সময়ের Up/Down পরিবর্তন (${periodTitle})*`
        : `*3. Upgradation & Downgradation Activity (${periodTitle})*`
    );

    if (report.periodChanges.length === 0) {
      lines.push(
        isBn
          ? '• এই সময়ে কোনো Completed Upgrade বা Downgrade হয়নি।'
          : '• No Completed Upgrade or Downgrade changes during this period.'
      );
    } else {
      report.periodChanges.forEach((c) => {
        const sign = c.signedDelta >= 0 ? '+' : '−';
        const loc = c.link?.customerName
          ? `${c.link.customerName} / ${c.link.popLocation}`
          : c.link?.popLocation || c.link?.name || '';
        lines.push(
          `• ${formatDateDMY(c.change.effectiveDate)} | ${c.link?.circuitId} (${
            c.link?.service
          }) | ${loc}: *${c.change.changeType} ${sign}${formatMbps(
            Math.abs(c.signedDelta)
          )} Mbps* (${formatMbps(c.beforeMbps)} → ${formatMbps(c.afterMbps)} Mbps)`
        );
      });
    }
    lines.push('');
  }

  if (report.summary.openTempTotalCount > 0) {
    lines.push(
      isBn
        ? `সতর্কতা: খোলা Temporary ${report.summary.openTempTotalCount}টি (মেয়াদ পেরিয়েছে: ${report.summary.overdueTempTotalCount}টি)`
        : `Notice: ${report.summary.openTempTotalCount} Open Temporary (Overdue: ${report.summary.overdueTempTotalCount})`
    );
  }

  lines.push(
    isBn
      ? '_দ্রষ্টব্য: Upstream ব্যান্ডউইথ ও NTTN আলাদা সেবা; এগুলো যোগ করে মোট ইন্টারনেট ধরা হয়নি।_'
      : '_Note: Upstream Bandwidth and NTTN are tracked separately._'
  );

  return lines.join('\n');
}

export function buildEmailReport(
  report: DispatchReportModel,
  lang: Language,
  options: ReportScopeOptions
): { subject: string; body: string } {
  const isBn = lang === 'bn';
  const periodTitle = isBn ? report.periodLabelBn : report.periodLabelEn;
  const subject =
    report.frequency === 'monthly'
      ? isBn
        ? `SpeedNet মাসিক ব্যান্ডউইথ ও NTTN ক্যাপাসিটি রিপোর্ট — ${periodTitle}`
        : `SpeedNet Monthly Bandwidth & NTTN Capacity Report — ${periodTitle}`
      : isBn
      ? `SpeedNet দৈনিক ব্যান্ডউইথ ও NTTN ক্যাপাসিটি রিপোর্ট — ${periodTitle}`
      : `SpeedNet Daily Bandwidth & NTTN Capacity Report — ${periodTitle}`;

  const lines: string[] = [];
  lines.push(isBn ? 'আসসালামু আলাইকুম,' : 'Dear Team,');
  lines.push('');
  lines.push(
    isBn
      ? `${periodTitle}-এর SpeedNet Upstream ব্যান্ডউইথ ও NTTN ক্যাপাসিটি এবং Upgradation/Downgradation রিপোর্ট নিচে দেওয়া হলো (হিসাবের তারিখ: ${formatDateDMY(
          report.periodEnd
        )}):`
      : `Please find below the SpeedNet Upstream Bandwidth & NTTN Capacity and Upgradation/Downgradation report for ${periodTitle} (As of ${formatDateDMY(
          report.periodEnd
        )}):`
  );
  lines.push('');

  if (options.includeUpstream) {
    lines.push(
      isBn
        ? `1. Provider অনুযায়ী বর্তমান Upstream ক্যাপাসিটি (মোট: ${formatMbps(
            report.summary.upstreamTotalMbps
          )} Mbps / ${formatGbps(report.summary.upstreamTotalMbps)})`
        : `1. Current Upstream Bandwidth by Provider (Total: ${formatMbps(
            report.summary.upstreamTotalMbps
          )} Mbps / ${formatGbps(report.summary.upstreamTotalMbps)})`
    );
    lines.push('------------------------------------------------------------');
    report.summary.providerRows
      .filter((r) => r.provider.category === 'Upstream')
      .forEach((row) => {
        const parts = UPSTREAM_SERVICES.filter((s) => row.byService[s] > 0).map(
          (s) => `${s}: ${formatMbps(row.byService[s])} Mbps`
        );
        const provChgs = report.changesByProviderId[row.provider.id] || [];
        const statusStr =
          provChgs.length > 0
            ? formatLinkChangeSummary(provChgs, lang)
            : isBn
            ? 'অপরিবর্তিত'
            : 'No change';
        lines.push(
          `- ${row.provider.name}: ${formatMbps(row.totalMbps)} Mbps [${parts.join(' | ')}] | ${
            isBn ? 'Up/Down:' : 'Change:'
          } ${statusStr}`
        );
      });
    lines.push('');
  }

  if (options.includeNttn) {
    lines.push(
      isBn
        ? `2. NTTN Provider ও গ্রাহক/POP অনুযায়ী ক্যাপাসিটি (মোট: ${formatMbps(
            report.summary.nttnTotalMbps
          )} Mbps | ${toDisplaySerial(report.nttnLinks.length, lang)}টি লিংক)`
        : `2. NTTN Capacity by Provider & Customer/POP (Total: ${formatMbps(
            report.summary.nttnTotalMbps
          )} Mbps | ${report.nttnLinks.length} links)`
    );
    lines.push('------------------------------------------------------------');
    report.summary.providerRows
      .filter((r) => r.provider.category === 'NTTN')
      .forEach((pRow) => {
        lines.push(
          `${pRow.provider.name} — ${formatMbps(pRow.totalMbps)} Mbps (${pRow.linkCount} ${
            isBn ? 'টি লিংক' : 'links'
          }):`
        );
        const provLinks = report.nttnLinks.filter(
          (item) => item.link.providerId === pRow.provider.id
        );
        provLinks.forEach((item, idx) => {
          const customerLabel = item.link.customerName
            ? `${item.link.customerName} — ${item.link.popLocation}`
            : item.link.popLocation;
          const upDown = formatLinkChangeSummary(item.periodChanges, lang);
          lines.push(
            `  ${idx + 1}. ${item.link.circuitId} (${item.link.providerLinkId || 'N/A'}) | ${customerLabel} | ${formatMbps(
              item.currentMbps
            )} Mbps | ${upDown}`
          );
        });
        lines.push('');
      });
  }

  if (options.includePeriodChanges) {
    lines.push(
      isBn
        ? `3. ${periodTitle}-এর Upgradation ও Downgradation বিবরণ`
        : `3. Upgradation & Downgradation Changes (${periodTitle})`
    );
    lines.push('------------------------------------------------------------');
    if (report.periodChanges.length === 0) {
      lines.push(
        isBn
          ? '- এই সময়ে কোনো Completed Upgrade বা Downgrade পরিবর্তন হয়নি।'
          : '- No Completed Upgrade or Downgrade changes recorded during this period.'
      );
    } else {
      report.periodChanges.forEach((c) => {
        const sign = c.signedDelta >= 0 ? '+' : '−';
        const loc = c.link?.customerName
          ? `${c.link.customerName} (${c.link.popLocation})`
          : c.link?.popLocation || c.link?.name || '';
        lines.push(
          `- ${formatDateDMY(c.change.effectiveDate)} | ${c.change.changeCode} | ${
            c.provider?.name || ''
          } | ${c.link?.circuitId} (${c.link?.service}) | ${loc} | ${
            c.change.changeType
          }: ${sign}${formatMbps(Math.abs(c.signedDelta))} Mbps (${formatMbps(
            c.beforeMbps
          )} -> ${formatMbps(c.afterMbps)} Mbps)${
            c.change.remarks ? ` | ${c.change.remarks}` : ''
          }`
        );
      });
    }
    lines.push('');
  }

  lines.push(
    isBn
      ? 'বিঃদ্রঃ সব ক্যাপাসিটি Mbps। Upstream ব্যান্ডউইথ ও NTTN আলাদা সেবা হিসেবে হিসাব করা হয়েছে।'
      : 'Note: All capacities are in Mbps. Upstream Bandwidth and NTTN are reported separately.'
  );
  lines.push('');
  lines.push('Regards,');
  lines.push('SpeedNet Operations');

  return { subject, body: lines.join('\n') };
}

export function exportPeriodReportXlsx(report: DispatchReportModel, lang: Language) {
  const wb = XLSX.utils.book_new();
  const periodTitle = lang === 'bn' ? report.periodLabelBn : report.periodLabelEn;

  // Sheet 1: Upstream Provider Summary
  const upRows: (string | number)[][] = [
    [`SpeedNet ${report.frequency === 'monthly' ? 'Monthly' : 'Daily'} Capacity Report — ${periodTitle}`],
    ['Period Start', report.periodStart, 'Period End (As-of)', report.periodEnd],
    [],
    ['Provider অনুযায়ী বর্তমান Upstream ক্যাপাসিটি (Mbps)'],
    ['Provider', ...UPSTREAM_SERVICES, 'মোট Mbps', 'লিংক সংখ্যা', 'এই সময়ের Up/Down'],
  ];

  report.summary.providerRows
    .filter((r) => r.provider.category === 'Upstream')
    .forEach((row) => {
      const chgs = report.changesByProviderId[row.provider.id] || [];
      upRows.push([
        row.provider.name,
        ...UPSTREAM_SERVICES.map((s) => (row.byService[s] > 0 ? row.byService[s] : '')),
        row.totalMbps,
        row.linkCount,
        formatLinkChangeSummary(chgs, lang),
      ]);
    });

  upRows.push([
    'Upstream মোট',
    ...UPSTREAM_SERVICES.map((s) => {
      const sr = report.summary.serviceRows.find((x) => x.service === s);
      return sr && sr.currentMbps > 0 ? sr.currentMbps : '';
    }),
    report.summary.upstreamTotalMbps,
    report.summary.upstreamLinkCount,
    '',
  ]);

  const wsUp = XLSX.utils.aoa_to_sheet(upRows);
  wsUp['!cols'] = [
    { wch: 30 },
    ...UPSTREAM_SERVICES.map(() => ({ wch: 10 })),
    { wch: 13 },
    { wch: 11 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUp, 'Upstream Summary');

  // Sheet 2: NTTN Customer / POP Report
  const nttnRows: (string | number)[][] = [
    [`SpeedNet NTTN Provider ও গ্রাহক/POP রিপোর্ট — ${periodTitle}`],
    ['হিসাবের তারিখ', formatDateDMY(report.periodEnd)],
    [],
    [
      'ক্রম',
      'Link Key',
      'Provider',
      'Link ID',
      'গ্রাহক / কাস্টমার',
      'এলাকা / POP (রুট)',
      'শুরুর তারিখ',
      'বর্তমান ক্যাপাসিটি (Mbps)',
      'এই সময়ের Up/Down অবস্থা',
      'নোট / স্ট্যাটাস',
    ],
  ];

  report.nttnLinks.forEach((item, idx) => {
    nttnRows.push([
      idx + 1,
      item.link.circuitId,
      item.provider?.name || '',
      item.link.providerLinkId || '',
      item.link.customerName || '',
      item.link.popLocation,
      formatDateDMY(item.link.startDate),
      item.currentMbps,
      formatLinkChangeSummary(item.periodChanges, lang),
      item.link.statusNote || 'Active',
    ]);
  });

  nttnRows.push([
    'মোট',
    '',
    '',
    '',
    '',
    '',
    '',
    report.summary.nttnTotalMbps,
    `${report.nttnLinks.length}টি লিংক`,
    '',
  ]);

  const wsNttn = XLSX.utils.aoa_to_sheet(nttnRows);
  wsNttn['!cols'] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 30 },
    { wch: 23 },
    { wch: 22 },
    { wch: 34 },
    { wch: 13 },
    { wch: 20 },
    { wch: 34 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsNttn, 'NTTN Customer Report');

  // Sheet 3: Period Up/Down Changes
  const chgRows: (string | number)[][] = [
    [`Upgradation & Downgradation Log — ${periodTitle}`],
    [],
    [
      'তারিখ',
      'কোড',
      'Provider',
      'Service',
      'Link Key',
      'গ্রাহক / POP',
      'ধরন',
      'পূর্বের Mbps',
      'পরিবর্তন Mbps',
      'নতুন Mbps',
      'রেফারেন্স / মন্তব্য',
    ],
  ];

  report.periodChanges.forEach((c) => {
    chgRows.push([
      formatDateDMY(c.change.effectiveDate),
      c.change.changeCode,
      c.provider?.name || '',
      c.link?.service || '',
      c.link?.circuitId || '',
      c.link?.customerName
        ? `${c.link.customerName} (${c.link.popLocation})`
        : c.link?.popLocation || '',
      c.change.changeType,
      c.beforeMbps,
      getSignedDelta(c.change.changeType, c.change.amountMbps),
      c.afterMbps,
      [c.change.referenceNo, c.change.remarks].filter(Boolean).join(' — '),
    ]);
  });

  const wsChg = XLSX.utils.aoa_to_sheet(chgRows);
  wsChg['!cols'] = [
    { wch: 13 },
    { wch: 15 },
    { wch: 28 },
    { wch: 10 },
    { wch: 20 },
    { wch: 34 },
    { wch: 18 },
    { wch: 13 },
    { wch: 14 },
    { wch: 13 },
    { wch: 34 },
  ];
  XLSX.utils.book_append_sheet(wb, wsChg, 'Period Up-Down');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SpeedNet_${report.frequency}_Report_${
    report.frequency === 'monthly' ? report.periodStart.slice(0, 7) : report.periodEnd
  }.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
