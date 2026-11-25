import {
  ALL_SERVICES,
  CapacityChange,
  ChangeType,
  ComputedRegisterSummary,
  Language,
  LinkChangeHistoryEntry,
  LinkComputedState,
  MonthlyMovementRow,
  NetworkLink,
  Provider,
  ProviderSummaryRow,
  RegisterData,
  ServiceSummaryRow,
  ServiceType,
  TemporaryTrackerItem,
  ValidationIssue,
} from '../types/register';

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toDisplaySerial(num: number, lang: Language): string {
  if (lang === 'en') return String(num);
  return String(num)
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? BN_DIGITS[Number(ch)] : ch))
    .join('');
}

export function formatDateDMY(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export function getSignedDelta(changeType: ChangeType, amountMbps: number): number {
  const abs = Math.abs(Number(amountMbps) || 0);
  if (changeType === 'Upgrade' || changeType === 'Temporary Upgrade') {
    return abs;
  }
  return -abs;
}

export function diffDays(earlierYmd: string, laterYmd: string): number {
  const a = new Date(`${earlierYmd}T00:00:00Z`).getTime();
  const b = new Date(`${laterYmd}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function formatMbps(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatGbps(mbps: number): string {
  const gbps = mbps / 1000;
  return `${gbps.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Gbps`;
}

export function computeLinkCapacityAtDate(
  link: NetworkLink,
  changes: CapacityChange[],
  asOfDate: string,
  excludeChangeId?: string
): number {
  let capacity = Number(link.initialMbps) || 0;
  for (const chg of changes) {
    if (chg.id === excludeChangeId) continue;
    if (chg.linkId !== link.id) continue;
    if (chg.status !== 'Completed') continue;
    if (!chg.effectiveDate || chg.effectiveDate > asOfDate) continue;
    capacity += getSignedDelta(chg.changeType, chg.amountMbps);
  }
  return capacity;
}

export function computeRegisterSummary(
  data: RegisterData,
  asOfDate: string,
  reportYear: number
): ComputedRegisterSummary {
  const providerMap = new Map<string, Provider>();
  data.providers.forEach((p) => providerMap.set(p.id, p));

  const linkMap = new Map<string, NetworkLink>();
  data.links.forEach((l) => linkMap.set(l.id, l));

  const issues: ValidationIssue[] = [];

  // 1. Setup Validation ("সেটআপ অসম্পূর্ণ")
  data.providers.forEach((p) => {
    const trimmed = p.name.trim();
    if (!trimmed || /^provider\s*\d+$/i.test(trimmed)) {
      issues.push({
        id: `setup-prov-${p.id}`,
        scope: 'setup',
        severity: 'error',
        entityId: p.id,
        entityLabel: trimmed || p.id,
        messageBn: 'Provider-এর আসল নাম দেওয়া হয়নি।',
        messageEn: 'Provider is missing a valid organization name.',
      });
    }
  });

  data.links.forEach((link) => {
    if (!link.active) return;
    const provider = providerMap.get(link.providerId);
    const label = link.circuitId || link.name || link.id;
    if (!link.circuitId.trim() || !link.name.trim()) {
      issues.push({
        id: `setup-lnk-name-${link.id}`,
        scope: 'setup',
        severity: 'error',
        entityId: link.id,
        entityLabel: label,
        messageBn: `লিংক (${label})-এর Link Key বা নাম অসম্পূর্ণ।`,
        messageEn: `Link (${label}) is missing Link Key or name.`,
      });
    }
    if (!provider) {
      issues.push({
        id: `setup-lnk-prov-${link.id}`,
        scope: 'setup',
        severity: 'error',
        entityId: link.id,
        entityLabel: label,
        messageBn: `লিংক (${label})-এর জন্য বৈধ Provider নির্বাচন করা হয়নি।`,
        messageEn: `Link (${label}) does not reference a valid Provider.`,
      });
    } else {
      if (provider.category === 'NTTN' && link.service !== 'NTTN') {
        issues.push({
          id: `setup-lnk-cat-${link.id}`,
          scope: 'setup',
          severity: 'error',
          entityId: link.id,
          entityLabel: label,
          messageBn: `NTTN Provider-এর লিংক (${label})-এ সেবা অবশ্যই NTTN হতে হবে।`,
          messageEn: `NTTN provider link (${label}) must use the NTTN service type.`,
        });
      }
      if (provider.category === 'Upstream' && link.service === 'NTTN') {
        issues.push({
          id: `setup-lnk-cat-${link.id}`,
          scope: 'setup',
          severity: 'error',
          entityId: link.id,
          entityLabel: label,
          messageBn: `Upstream Provider-এর লিংক (${label})-এ NTTN সেবা রাখা যাবে না।`,
          messageEn: `Upstream provider link (${label}) cannot use the NTTN service type.`,
        });
      }
    }
    if (
      link.initialMbps === null ||
      link.initialMbps === undefined ||
      Number.isNaN(Number(link.initialMbps)) ||
      Number(link.initialMbps) < 0
    ) {
      issues.push({
        id: `setup-lnk-cap-${link.id}`,
        scope: 'setup',
        severity: 'error',
        entityId: link.id,
        entityLabel: label,
        messageBn: `লিংক (${label})-এর শুরুর ক্যাপাসিটি শূন্য বা তার বেশি হতে হবে।`,
        messageEn: `Link (${label}) initial capacity must be >= 0 Mbps.`,
      });
    }
  });

  // 2. Completed Change Validation ("Completed ত্রুটি")
  const changeById = new Map<string, CapacityChange>();
  data.changes.forEach((c) => changeById.set(c.id, c));

  const completedReturnsAllTime = new Map<string, number>();
  data.changes.forEach((chg) => {
    if (
      chg.status === 'Completed' &&
      chg.changeType === 'Temporary Return' &&
      chg.relatedChangeId
    ) {
      completedReturnsAllTime.set(
        chg.relatedChangeId,
        (completedReturnsAllTime.get(chg.relatedChangeId) || 0) +
          Math.abs(Number(chg.amountMbps) || 0)
      );
    }
  });

  data.changes.forEach((chg) => {
    if (chg.status !== 'Completed') return;
    const label = chg.changeCode || chg.id;
    const link = linkMap.get(chg.linkId);
    if (!link) {
      issues.push({
        id: `chg-link-${chg.id}`,
        scope: 'completed',
        severity: 'error',
        entityId: chg.id,
        entityLabel: label,
        messageBn: `${label}: নির্বাচিত লিংক Setup-এ পাওয়া যায়নি।`,
        messageEn: `${label}: Referenced link does not exist in Setup.`,
      });
    }
    if (!chg.effectiveDate) {
      issues.push({
        id: `chg-date-${chg.id}`,
        scope: 'completed',
        severity: 'error',
        entityId: chg.id,
        entityLabel: label,
        messageBn: `${label}: কার্যকর তারিখ দেওয়া হয়নি।`,
        messageEn: `${label}: Effective date is required for Completed entries.`,
      });
    }
    if (!Number.isFinite(chg.amountMbps) || chg.amountMbps <= 0) {
      issues.push({
        id: `chg-amt-${chg.id}`,
        scope: 'completed',
        severity: 'error',
        entityId: chg.id,
        entityLabel: label,
        messageBn: `${label}: পরিবর্তনের অঙ্ক ০-এর চেয়ে বেশি হতে হবে।`,
        messageEn: `${label}: Change amount must be greater than 0 Mbps.`,
      });
    }
    if (chg.changeType === 'Temporary Upgrade' && !chg.returnDueDate) {
      issues.push({
        id: `chg-due-${chg.id}`,
        scope: 'completed',
        severity: 'error',
        entityId: chg.id,
        entityLabel: label,
        messageBn: `${label}: Temporary Upgrade-এর ফেরতের মেয়াদ (Return Due Date) দিতে হবে।`,
        messageEn: `${label}: Return Due Date is required for Temporary Upgrades.`,
      });
    }
    if (chg.changeType === 'Temporary Return') {
      if (!chg.relatedChangeId || !changeById.has(chg.relatedChangeId)) {
        issues.push({
          id: `chg-rel-${chg.id}`,
          scope: 'completed',
          severity: 'error',
          entityId: chg.id,
          entityLabel: label,
          messageBn: `${label}: Temporary Return-এর সাথে মূল Temporary Upgrade লিংক করা হয়নি।`,
          messageEn: `${label}: Temporary Return must reference an original Temporary Upgrade.`,
        });
      } else {
        const orig = changeById.get(chg.relatedChangeId)!;
        const totalRet = completedReturnsAllTime.get(orig.id) || 0;
        if (totalRet > orig.amountMbps) {
          issues.push({
            id: `chg-overret-${chg.id}`,
            scope: 'completed',
            severity: 'error',
            entityId: chg.id,
            entityLabel: label,
            messageBn: `${label}: ফেরতের মোট অঙ্ক (${formatMbps(totalRet)} Mbps) মূল Temporary অঙ্ক (${formatMbps(orig.amountMbps)} Mbps)-এর চেয়ে বেশি।`,
            messageEn: `${label}: Returned total (${formatMbps(totalRet)} Mbps) exceeds original Temporary amount (${formatMbps(orig.amountMbps)} Mbps).`,
          });
        }
      }
    }
  });

  // 3. Temporary Upgrade Tracker (as of asOfDate)
  const temporaryItems: TemporaryTrackerItem[] = [];
  const tempByChangeId = new Map<string, TemporaryTrackerItem>();
  const openTempByLink = new Map<string, { count: number; mbps: number; overdueCount: number }>();

  const tempUpgrades = data.changes
    .filter((c) => c.changeType === 'Temporary Upgrade' && c.status === 'Completed')
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  tempUpgrades.forEach((temp) => {
    if (!temp.effectiveDate || temp.effectiveDate > asOfDate) return;

    const returnEntries = data.changes
      .filter(
        (c) =>
          c.changeType === 'Temporary Return' &&
          c.status === 'Completed' &&
          c.relatedChangeId === temp.id &&
          c.effectiveDate <= asOfDate
      )
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

    const returnedMbps = returnEntries.reduce((sum, r) => sum + Math.abs(r.amountMbps || 0), 0);
    const remainingMbps = Math.max(0, (temp.amountMbps || 0) - returnedMbps);
    const isOpen = remainingMbps > 0;
    const isOverdue =
      isOpen && Boolean(temp.returnDueDate) && (temp.returnDueDate as string) < asOfDate;
    const daysOverdue =
      isOverdue && temp.returnDueDate ? diffDays(temp.returnDueDate, asOfDate) : 0;

    const link = linkMap.get(temp.linkId);
    const provider = link ? providerMap.get(link.providerId) : undefined;

    const item: TemporaryTrackerItem = {
      change: temp,
      link,
      provider,
      originalMbps: temp.amountMbps,
      returnedMbps,
      remainingMbps,
      isOpen,
      isOverdue,
      daysOverdue,
      returnEntries,
    };

    temporaryItems.push(item);
    tempByChangeId.set(temp.id, item);

    if (isOpen && link) {
      const prev = openTempByLink.get(link.id) || { count: 0, mbps: 0, overdueCount: 0 };
      prev.count += 1;
      prev.mbps += remainingMbps;
      if (isOverdue) prev.overdueCount += 1;
      openTempByLink.set(link.id, prev);
    }
  });

  // 4. Compute Per-Link Capacity & Full Chronological Change History
  const linkStates: Record<string, LinkComputedState> = {};

  data.links.forEach((link) => {
    const provider = providerMap.get(link.providerId);
    const allLinkChanges = data.changes
      .filter((c) => c.linkId === link.id)
      .sort(
        (a, b) =>
          (a.effectiveDate || '').localeCompare(b.effectiveDate || '') ||
          a.createdAt.localeCompare(b.createdAt)
      );

    let runningAsOf = Number(link.initialMbps) || 0;
    let runningChrono = Number(link.initialMbps) || 0;
    let hasNegativeError = false;
    let lastChangeDate: string | null = null;
    let netChangeMbps = 0;
    let completedChangeCount = 0;
    const history: LinkChangeHistoryEntry[] = [];

    for (const chg of allLinkChanges) {
      const delta = getSignedDelta(chg.changeType, chg.amountMbps);
      const isCompleted = chg.status === 'Completed' && Boolean(chg.effectiveDate);
      const appliedAsOfDate = isCompleted && chg.effectiveDate <= asOfDate;

      const beforeMbps = runningChrono;
      let afterMbps = runningChrono;

      if (isCompleted) {
        runningChrono += delta;
        afterMbps = runningChrono;
      }

      if (appliedAsOfDate) {
        runningAsOf += delta;
        netChangeMbps += delta;
        completedChangeCount += 1;
        if (!lastChangeDate || chg.effectiveDate > lastChangeDate) {
          lastChangeDate = chg.effectiveDate;
        }
        if (runningAsOf < 0 && !hasNegativeError) {
          hasNegativeError = true;
          issues.push({
            id: `chg-neg-${chg.id}`,
            scope: 'completed',
            severity: 'error',
            entityId: chg.id,
            entityLabel: chg.changeCode || chg.id,
            messageBn: `${chg.changeCode}: ${link.circuitId}-এর ক্যাপাসিটি শূন্যের নিচে (${formatMbps(runningAsOf)} Mbps) নেমে গেছে।`,
            messageEn: `${chg.changeCode}: Link ${link.circuitId} capacity dropped below 0 (${formatMbps(runningAsOf)} Mbps).`,
          });
        }
      }

      const tempTracker = tempByChangeId.get(chg.id);
      history.push({
        change: chg,
        signedDelta: delta,
        beforeMbps,
        afterMbps,
        appliedAsOfDate,
        isOpenTemp: tempTracker?.isOpen,
        isOverdueTemp: tempTracker?.isOverdue,
        remainingTempMbps: tempTracker?.remainingMbps,
      });
    }

    const tempStats = openTempByLink.get(link.id) || { count: 0, mbps: 0, overdueCount: 0 };

    linkStates[link.id] = {
      link,
      provider,
      currentMbps: runningAsOf,
      netChangeMbps,
      lastChangeDate,
      openTempMbps: tempStats.mbps,
      openTempCount: tempStats.count,
      overdueTempCount: tempStats.overdueCount,
      hasNegativeError,
      history,
      completedChangeCount,
    };
  });

  // 5. Provider Matrix Rows
  const providerRows: ProviderSummaryRow[] = data.providers.map((provider) => {
    const byService = {} as Record<ServiceType, number>;
    ALL_SERVICES.forEach((s) => {
      byService[s] = 0;
    });

    const providerLinks = data.links.filter((l) => l.providerId === provider.id && l.active);
    let totalMbps = 0;
    let lastChangeDate: string | null = null;
    let openTempCount = 0;
    let overdueTempCount = 0;

    providerLinks.forEach((lnk) => {
      const state = linkStates[lnk.id];
      if (!state) return;
      byService[lnk.service] = (byService[lnk.service] || 0) + state.currentMbps;
      totalMbps += state.currentMbps;
      openTempCount += state.openTempCount;
      overdueTempCount += state.overdueTempCount;
      if (state.lastChangeDate && (!lastChangeDate || state.lastChangeDate > lastChangeDate)) {
        lastChangeDate = state.lastChangeDate;
      }
    });

    return {
      provider,
      byService,
      totalMbps,
      linkCount: providerLinks.length,
      lastChangeDate,
      openTempCount,
      overdueTempCount,
    };
  });

  // 6. Service-wise Totals
  const serviceTotalsMap = new Map<
    ServiceType,
    { mbps: number; openTempCount: number; openTempMbps: number; overdueTempCount: number; linkCount: number }
  >();
  ALL_SERVICES.forEach((s) => {
    serviceTotalsMap.set(s, {
      mbps: 0,
      openTempCount: 0,
      openTempMbps: 0,
      overdueTempCount: 0,
      linkCount: 0,
    });
  });

  let upstreamTotalMbps = 0;
  let nttnTotalMbps = 0;
  let upstreamLinkCount = 0;
  let nttnLinkCount = 0;

  data.links.forEach((lnk) => {
    if (!lnk.active) return;
    const state = linkStates[lnk.id];
    if (!state) return;
    const bucket = serviceTotalsMap.get(lnk.service)!;
    bucket.mbps += state.currentMbps;
    bucket.openTempCount += state.openTempCount;
    bucket.openTempMbps += state.openTempMbps;
    bucket.overdueTempCount += state.overdueTempCount;
    bucket.linkCount += 1;

    if (lnk.service === 'NTTN') {
      nttnTotalMbps += state.currentMbps;
      nttnLinkCount += 1;
    } else {
      upstreamTotalMbps += state.currentMbps;
      upstreamLinkCount += 1;
    }
  });

  const serviceRows: ServiceSummaryRow[] = ALL_SERVICES.map((service) => {
    const bucket = serviceTotalsMap.get(service)!;
    const isNttn = service === 'NTTN';
    const denom = isNttn ? nttnTotalMbps : upstreamTotalMbps;
    return {
      service,
      category: isNttn ? 'NTTN' : 'Upstream',
      currentMbps: bucket.mbps,
      sharePercent: denom > 0 ? (bucket.mbps / denom) * 100 : 0,
      openTempCount: bucket.openTempCount,
      openTempMbps: bucket.openTempMbps,
      overdueTempCount: bucket.overdueTempCount,
      linkCount: bucket.linkCount,
    };
  });

  // 7. Monthly Movements for reportYear
  const monthlyMovements: MonthlyMovementRow[] = Array.from({ length: 12 }, (_, idx) => {
    const mStr = String(idx + 1).padStart(2, '0');
    return {
      monthIndex: idx,
      monthKey: `${reportYear}-${mStr}`,
      upstreamUpgrade: 0,
      upstreamDowngrade: 0,
      upstreamTempUp: 0,
      upstreamTempReturn: 0,
      upstreamNet: 0,
      nttnUpgrade: 0,
      nttnDowngrade: 0,
      nttnTempUp: 0,
      nttnTempReturn: 0,
      nttnNet: 0,
      completedCount: 0,
    };
  });

  let ytdUpstreamNet = 0;
  let ytdNttnNet = 0;
  let ytdUpgradeCount = 0;
  let ytdDowngradeCount = 0;

  data.changes.forEach((chg) => {
    if (chg.status !== 'Completed' || !chg.effectiveDate) return;
    const yearNum = Number(chg.effectiveDate.slice(0, 4));
    if (yearNum !== reportYear) return;
    const monthIdx = Number(chg.effectiveDate.slice(5, 7)) - 1;
    if (monthIdx < 0 || monthIdx > 11) return;

    const link = linkMap.get(chg.linkId);
    if (!link) return;

    const row = monthlyMovements[monthIdx];
    const amt = Math.abs(chg.amountMbps || 0);
    const isNttn = link.service === 'NTTN';
    row.completedCount += 1;

    if (chg.changeType === 'Upgrade') {
      ytdUpgradeCount += 1;
      if (isNttn) {
        row.nttnUpgrade += amt;
        row.nttnNet += amt;
        ytdNttnNet += amt;
      } else {
        row.upstreamUpgrade += amt;
        row.upstreamNet += amt;
        ytdUpstreamNet += amt;
      }
    } else if (chg.changeType === 'Temporary Upgrade') {
      ytdUpgradeCount += 1;
      if (isNttn) {
        row.nttnTempUp += amt;
        row.nttnNet += amt;
        ytdNttnNet += amt;
      } else {
        row.upstreamTempUp += amt;
        row.upstreamNet += amt;
        ytdUpstreamNet += amt;
      }
    } else if (chg.changeType === 'Downgrade') {
      ytdDowngradeCount += 1;
      if (isNttn) {
        row.nttnDowngrade += amt;
        row.nttnNet -= amt;
        ytdNttnNet -= amt;
      } else {
        row.upstreamDowngrade += amt;
        row.upstreamNet -= amt;
        ytdUpstreamNet -= amt;
      }
    } else if (chg.changeType === 'Temporary Return') {
      ytdDowngradeCount += 1;
      if (isNttn) {
        row.nttnTempReturn += amt;
        row.nttnNet -= amt;
        ytdNttnNet -= amt;
      } else {
        row.upstreamTempReturn += amt;
        row.upstreamNet -= amt;
        ytdUpstreamNet -= amt;
      }
    }
  });

  const openTempTotalCount = temporaryItems.filter((t) => t.isOpen).length;
  const overdueTempTotalCount = temporaryItems.filter((t) => t.isOverdue).length;
  const pendingRequestsCount = data.changes.filter((c) => c.status === 'Requested').length;
  const setupIncompleteCount = issues.filter((i) => i.scope === 'setup').length;
  const completedErrorsCount = issues.filter((i) => i.scope === 'completed').length;

  return {
    asOfDate,
    reportYear,
    upstreamTotalMbps,
    nttnTotalMbps,
    upstreamLinkCount,
    nttnLinkCount,
    providerRows,
    serviceRows,
    linkStates,
    temporaryItems,
    openTempTotalCount,
    overdueTempTotalCount,
    pendingRequestsCount,
    setupIncompleteCount,
    completedErrorsCount,
    issues,
    monthlyMovements,
    ytdUpstreamNet,
    ytdNttnNet,
    ytdUpgradeCount,
    ytdDowngradeCount,
  };
}
