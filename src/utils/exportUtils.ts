import * as XLSX from 'xlsx';
import {
  ALL_SERVICES,
  ComputedRegisterSummary,
  RegisterData,
} from '../types/register';
import { formatDateDMY, formatMbps, getSignedDelta } from './calculations';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildNttnSheetRows(data: RegisterData, summary: ComputedRegisterSummary) {
  const provMap = new Map(data.providers.map((p) => [p.id, p]));
  const nttnLinks = data.links.filter((l) => l.service === 'NTTN' && l.active);

  const rows: (string | number)[][] = [
    ['SpeedNet NTTN Link Capacity & Change Report'],
    ['হিসাবের তারিখ', summary.asOfDate, '', 'রিপোর্টের বছর', summary.reportYear],
    [],
    [
      'ক্রম',
      'Link Key',
      'Provider',
      'Service',
      'Link ID',
      'এলাকা / POP (রুট)',
      'শুরুর তারিখ',
      'শুরুর ক্যাপাসিটি (Mbps)',
      'বর্তমান ক্যাপাসিটি (Mbps)',
      'নোট / স্ট্যাটাস',
      'পরিবর্তনের ইতিহাস (তারিখসহ)',
    ],
  ];

  let totalCurrent = 0;
  let totalInitial = 0;

  nttnLinks.forEach((lnk, idx) => {
    const prov = provMap.get(lnk.providerId);
    const st = summary.linkStates[lnk.id];
    const current = st ? st.currentMbps : lnk.initialMbps;
    totalCurrent += current;
    totalInitial += lnk.initialMbps;

    const historyText =
      st && st.history.length > 0
        ? st.history
            .map((h) => {
              const sign = h.signedDelta >= 0 ? '+' : '−';
              const due = h.change.returnDueDate
                ? ` [Due: ${formatDateDMY(h.change.returnDueDate)}]`
                : '';
              return `${formatDateDMY(h.change.effectiveDate)}: ${h.change.changeType} ${sign}${formatMbps(
                Math.abs(h.signedDelta)
              )} Mbps (${formatMbps(h.beforeMbps)}→${formatMbps(h.afterMbps)}) [${
                h.change.status
              }]${due}`;
            })
            .join(' | ')
        : 'কোনো পরিবর্তন নেই';

    rows.push([
      idx + 1,
      lnk.circuitId,
      prov?.name || '',
      lnk.service,
      lnk.providerLinkId || '',
      lnk.popLocation || lnk.name,
      formatDateDMY(lnk.startDate),
      lnk.initialMbps,
      current,
      lnk.statusNote || (lnk.active ? 'Active' : 'Inactive'),
      historyText,
    ]);
  });

  rows.push([
    'মোট',
    '',
    '',
    '',
    '',
    '',
    '',
    totalInitial,
    totalCurrent,
    `${nttnLinks.length}টি লিংক`,
    '',
  ]);

  return rows;
}

/**
 * Exports a dedicated NTTN Link Report workbook matching the exact requested format,
 * including a second tab with all NTTN dated Upgrade/Downgrade/Temporary changes.
 */
export function exportNttnReportXlsx(
  data: RegisterData,
  summary: ComputedRegisterSummary
) {
  const wb = XLSX.utils.book_new();
  const nttnRows = buildNttnSheetRows(data, summary);
  const wsNttn = XLSX.utils.aoa_to_sheet(nttnRows);
  wsNttn['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 30 },
    { wch: 9 },
    { wch: 24 },
    { wch: 36 },
    { wch: 13 },
    { wch: 18 },
    { wch: 19 },
    { wch: 24 },
    { wch: 52 },
  ];
  XLSX.utils.book_append_sheet(wb, wsNttn, 'NTTN Link Report');

  // Second tab: NTTN Change History Log
  const linkMap = new Map(data.links.map((l) => [l.id, l]));
  const provMap = new Map(data.providers.map((p) => [p.id, p]));
  const nttnChanges = [...data.changes]
    .filter((c) => linkMap.get(c.linkId)?.service === 'NTTN')
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  const logRows: (string | number)[][] = [
    [
      'Change Code',
      'তারিখ (Effective Date)',
      'Link Key',
      'Link ID',
      'Provider',
      'এলাকা / POP (রুট)',
      'ধরন (Type)',
      'পরিবর্তন (Mbps)',
      'অবস্থা (Status)',
      'ফেরতের মেয়াদ',
      'রেফারেন্স',
      'মন্তব্য',
    ],
  ];

  nttnChanges.forEach((chg) => {
    const lnk = linkMap.get(chg.linkId);
    const prov = lnk ? provMap.get(lnk.providerId) : undefined;
    logRows.push([
      chg.changeCode,
      formatDateDMY(chg.effectiveDate),
      lnk?.circuitId || '',
      lnk?.providerLinkId || '',
      prov?.name || '',
      lnk?.popLocation || lnk?.name || '',
      chg.changeType,
      getSignedDelta(chg.changeType, chg.amountMbps),
      chg.status,
      chg.returnDueDate ? formatDateDMY(chg.returnDueDate) : '',
      chg.referenceNo || '',
      chg.remarks || '',
    ]);
  });

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 22 },
    { wch: 24 },
    { wch: 30 },
    { wch: 34 },
    { wch: 18 },
    { wch: 15 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLog, 'NTTN Change History');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `SpeedNet_NTTN_Link_Report_${summary.asOfDate}.xlsx`);
}

/**
 * Exports a complete multi-sheet Excel workbook (.xlsx) with 4 operational tabs:
 *  1. Summary
 *  2. NTTN Report (exact 17+ circuit report with dated change history)
 *  3. Changes (full Upgrade / Downgrade / Temporary / Return ledger)
 *  4. Setup (Providers & individual link starting capacities)
 */
export function exportWorkbookXlsx(
  data: RegisterData,
  summary: ComputedRegisterSummary
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryRows: (string | number)[][] = [
    ['SpeedNet Capacity Register'],
    [
      'হিসাবের তারিখ',
      summary.asOfDate,
      '',
      'রিপোর্টের বছর',
      summary.reportYear,
      '',
      'সেটআপ অসম্পূর্ণ',
      summary.setupIncompleteCount,
      '',
      'Completed ত্রুটি',
      summary.completedErrorsCount,
    ],
    [
      'সব ক্যাপাসিটি Mbps। IIG/কনটেন্ট এবং NTTN আলাদা সেবা; এগুলো যোগ করে ইন্টারনেটের মোট ধরবেন না।',
    ],
    [],
    ['Provider অনুযায়ী বর্তমান ক্যাপাসিটি'],
    ['Provider', 'ধরন', ...ALL_SERVICES, 'লিংক সংখ্যা', 'শেষ পরিবর্তন'],
  ];

  summary.providerRows.forEach((row) => {
    summaryRows.push([
      row.provider.name,
      row.provider.category,
      ...ALL_SERVICES.map((svc) => (row.byService[svc] ? row.byService[svc] : '')),
      row.linkCount,
      row.lastChangeDate || '',
    ]);
  });

  summaryRows.push([]);
  summaryRows.push(['সেবা অনুযায়ী মোট']);
  summaryRows.push(['সেবা', 'ধরন', 'বর্তমান Mbps', 'খোলা Temporary', 'ফেরতের মেয়াদ পেরিয়েছে']);

  summary.serviceRows.forEach((s) => {
    summaryRows.push([
      s.service,
      s.category,
      s.currentMbps || 0,
      s.openTempCount,
      s.overdueTempCount,
    ]);
  });

  summaryRows.push([]);
  summaryRows.push(['Upstream মোট (IIG/কনটেন্ট)', 'Upstream', summary.upstreamTotalMbps]);
  summaryRows.push(['NTTN মোট (আলাদা ট্রান্সমিশন)', 'NTTN', summary.nttnTotalMbps]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 34 },
    { wch: 12 },
    ...ALL_SERVICES.map(() => ({ wch: 11 })),
    { wch: 12 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: NTTN Report
  const wsNttn = XLSX.utils.aoa_to_sheet(buildNttnSheetRows(data, summary));
  wsNttn['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 30 },
    { wch: 9 },
    { wch: 24 },
    { wch: 36 },
    { wch: 13 },
    { wch: 18 },
    { wch: 19 },
    { wch: 24 },
    { wch: 52 },
  ];
  XLSX.utils.book_append_sheet(wb, wsNttn, 'NTTN Report');

  // Sheet 3: Changes
  const linkMap = new Map(data.links.map((l) => [l.id, l]));
  const provMap = new Map(data.providers.map((p) => [p.id, p]));

  const changesRows: (string | number)[][] = [
    [
      'Change Code',
      'Effective Date',
      'Provider',
      'Category',
      'Link Key',
      'Link ID',
      'Area / POP (Route)',
      'Service',
      'Change Type',
      'Signed Delta (Mbps)',
      'Status',
      'Return Due Date',
      'Reference No',
      'Remarks',
    ],
  ];

  const sortedChanges = [...data.changes].sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate)
  );
  sortedChanges.forEach((chg) => {
    const link = linkMap.get(chg.linkId);
    const prov = link ? provMap.get(link.providerId) : undefined;
    changesRows.push([
      chg.changeCode,
      chg.effectiveDate,
      prov?.name || '',
      prov?.category || '',
      link?.circuitId || '',
      link?.providerLinkId || '',
      link?.popLocation || link?.name || '',
      link?.service || '',
      chg.changeType,
      getSignedDelta(chg.changeType, chg.amountMbps),
      chg.status,
      chg.returnDueDate || '',
      chg.referenceNo || '',
      chg.remarks || '',
    ]);
  });

  const wsChanges = XLSX.utils.aoa_to_sheet(changesRows);
  wsChanges['!cols'] = [
    { wch: 15 },
    { wch: 14 },
    { wch: 30 },
    { wch: 11 },
    { wch: 20 },
    { wch: 22 },
    { wch: 32 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsChanges, 'Changes');

  // Sheet 4: Setup
  const setupRows: (string | number)[][] = [
    [
      'Link Key',
      'Link ID',
      'Area / POP (Route)',
      'Provider',
      'Category',
      'Service',
      'Start Date',
      'Initial Mbps',
      'Current Mbps (As-of)',
      'Status Note',
      'Active',
    ],
  ];

  data.links.forEach((lnk) => {
    const prov = provMap.get(lnk.providerId);
    const st = summary.linkStates[lnk.id];
    setupRows.push([
      lnk.circuitId,
      lnk.providerLinkId || '',
      lnk.popLocation || lnk.name,
      prov?.name || '',
      prov?.category || '',
      lnk.service,
      lnk.startDate,
      lnk.initialMbps,
      st ? st.currentMbps : lnk.initialMbps,
      lnk.statusNote || '',
      lnk.active ? 'Active' : 'Inactive',
    ]);
  });

  const wsSetup = XLSX.utils.aoa_to_sheet(setupRows);
  wsSetup['!cols'] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 34 },
    { wch: 30 },
    { wch: 11 },
    { wch: 10 },
    { wch: 13 },
    { wch: 14 },
    { wch: 18 },
    { wch: 24 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSetup, 'Setup');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(
    blob,
    `SpeedNet_Capacity_Register_${summary.asOfDate}.xlsx`
  );
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportSummaryCsv(summary: ComputedRegisterSummary) {
  const lines: (string | number)[][] = [
    ['SpeedNet Capacity Register'],
    [
      'হিসাবের তারিখ',
      summary.asOfDate,
      '',
      'রিপোর্টের বছর',
      summary.reportYear,
      '',
      'সেটআপ অসম্পূর্ণ',
      summary.setupIncompleteCount,
      '',
      '',
      'Completed ত্রুটি',
      summary.completedErrorsCount,
    ],
    [
      'সব ক্যাপাসিটি Mbps। IIG/কনটেন্ট এবং NTTN আলাদা সেবা; এগুলো যোগ করে ইন্টারনেটের মোট ধরবেন না।',
    ],
    [],
    ['Provider অনুযায়ী বর্তমান ক্যাপাসিটি'],
    ['Provider', 'ধরন', ...ALL_SERVICES, 'লিংক সংখ্যা', 'শেষ পরিবর্তন'],
  ];

  summary.providerRows.forEach((row) => {
    lines.push([
      row.provider.name,
      row.provider.category,
      ...ALL_SERVICES.map((svc) => (row.byService[svc] ? row.byService[svc] : '')),
      row.linkCount,
      row.lastChangeDate || '',
    ]);
  });

  lines.push([]);
  lines.push(['সেবা অনুযায়ী মোট']);
  lines.push(['সেবা', 'বর্তমান Mbps', 'খোলা Temporary', 'ফেরতের মেয়াদ পেরিয়েছে']);

  summary.serviceRows.forEach((s) => {
    lines.push([
      s.service,
      s.currentMbps || '',
      s.openTempCount,
      s.overdueTempCount,
    ]);
  });

  const csvContent =
    '\uFEFF' + lines.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(
    blob,
    `SpeedNet_Capacity_Summary_${summary.asOfDate}.csv`
  );
}

export function exportBackupJson(data: RegisterData, asOfDate: string) {
  const payload = {
    app: 'SpeedNet Capacity Register',
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `SpeedNet_Register_Backup_${asOfDate}.json`);
}
