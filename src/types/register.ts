export type Language = 'bn' | 'en';

export type ProviderCategory = 'Upstream' | 'NTTN';

export type ServiceType =
  | 'IIG'
  | 'GGC'
  | 'FNA'
  | 'BDIX'
  | 'CDN'
  | 'bCDN'
  | 'PNI'
  | 'NTTN'
  | 'Other';

export const ALL_SERVICES: ServiceType[] = [
  'IIG',
  'GGC',
  'FNA',
  'BDIX',
  'CDN',
  'bCDN',
  'PNI',
  'NTTN',
  'Other',
];

export const UPSTREAM_SERVICES: ServiceType[] = [
  'IIG',
  'GGC',
  'FNA',
  'BDIX',
  'CDN',
  'bCDN',
  'PNI',
  'Other',
];

export type ChangeType =
  | 'Upgrade'
  | 'Downgrade'
  | 'Temporary Upgrade'
  | 'Temporary Return';

export type ChangeStatus = 'Requested' | 'Completed' | 'Cancelled';

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  contactPerson?: string;
  notes?: string;
}

export interface NetworkLink {
  id: string;
  circuitId: string; // Link Key e.g. NTTN-SCOMM-01
  providerLinkId?: string; // Provider Link ID e.g. spnt_270823_072_nb or 146726
  customerName?: string; // Optional Customer / Client name for NTTN or dedicated links
  name: string; // Descriptive route or link label
  providerId: string;
  service: ServiceType;
  popLocation: string; // এলাকা / POP (রুট)
  startDate: string; // YYYY-MM-DD
  initialMbps: number;
  active: boolean;
  statusNote?: string; // e.g. Active, Active (Core), Dark core / ND Link
  notes?: string;
}

export interface CapacityChange {
  id: string;
  changeCode: string; // e.g., CHG-2026-001
  effectiveDate: string; // YYYY-MM-DD
  linkId: string;
  changeType: ChangeType;
  amountMbps: number; // Always stored as positive magnitude
  status: ChangeStatus;
  returnDueDate?: string; // Required when changeType === 'Temporary Upgrade'
  relatedChangeId?: string; // Links a Temporary Return back to a Temporary Upgrade
  referenceNo?: string; // Mail / Ticket / Work Order No
  remarks?: string;
  createdAt: string;
}

export interface RegisterData {
  providers: Provider[];
  links: NetworkLink[];
  changes: CapacityChange[];
}

export interface ValidationIssue {
  id: string;
  scope: 'setup' | 'completed';
  severity: 'error';
  entityId: string;
  entityLabel: string;
  messageBn: string;
  messageEn: string;
}

export interface LinkChangeHistoryEntry {
  change: CapacityChange;
  signedDelta: number;
  beforeMbps: number;
  afterMbps: number;
  appliedAsOfDate: boolean;
  isOpenTemp?: boolean;
  isOverdueTemp?: boolean;
  remainingTempMbps?: number;
}

export interface LinkComputedState {
  link: NetworkLink;
  provider: Provider | undefined;
  currentMbps: number;
  netChangeMbps: number;
  lastChangeDate: string | null;
  openTempMbps: number;
  openTempCount: number;
  overdueTempCount: number;
  hasNegativeError: boolean;
  history: LinkChangeHistoryEntry[];
  completedChangeCount: number;
}

export interface ProviderSummaryRow {
  provider: Provider;
  byService: Record<ServiceType, number>;
  totalMbps: number;
  linkCount: number;
  lastChangeDate: string | null;
  openTempCount: number;
  overdueTempCount: number;
}

export interface ServiceSummaryRow {
  service: ServiceType;
  category: ProviderCategory;
  currentMbps: number;
  sharePercent: number;
  openTempCount: number;
  openTempMbps: number;
  overdueTempCount: number;
  linkCount: number;
}

export interface TemporaryTrackerItem {
  change: CapacityChange;
  link: NetworkLink | undefined;
  provider: Provider | undefined;
  originalMbps: number;
  returnedMbps: number;
  remainingMbps: number;
  isOpen: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  returnEntries: CapacityChange[];
}

export interface MonthlyMovementRow {
  monthIndex: number; // 0..11
  monthKey: string; // YYYY-MM
  upstreamUpgrade: number;
  upstreamDowngrade: number;
  upstreamTempUp: number;
  upstreamTempReturn: number;
  upstreamNet: number;
  nttnUpgrade: number;
  nttnDowngrade: number;
  nttnTempUp: number;
  nttnTempReturn: number;
  nttnNet: number;
  completedCount: number;
}

export interface ComputedRegisterSummary {
  asOfDate: string;
  reportYear: number;
  upstreamTotalMbps: number;
  nttnTotalMbps: number;
  upstreamLinkCount: number;
  nttnLinkCount: number;
  providerRows: ProviderSummaryRow[];
  serviceRows: ServiceSummaryRow[];
  linkStates: Record<string, LinkComputedState>;
  temporaryItems: TemporaryTrackerItem[];
  openTempTotalCount: number;
  overdueTempTotalCount: number;
  pendingRequestsCount: number;
  setupIncompleteCount: number;
  completedErrorsCount: number;
  issues: ValidationIssue[];
  monthlyMovements: MonthlyMovementRow[];
  ytdUpstreamNet: number;
  ytdNttnNet: number;
  ytdUpgradeCount: number;
  ytdDowngradeCount: number;
}

export type ActiveTab = 'summary' | 'nttn' | 'changes' | 'setup' | 'temporary' | 'reports';
