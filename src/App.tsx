import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Cable,
  Calendar,
  Clock,
  FileBarChart2,
  LayoutDashboard,
  Menu,
  Network,
  Plus,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  CapacityChange,
  ChangeStatus,
  ChangeType,
  Language,
  NetworkLink,
  Provider,
  RegisterData,
} from './types/register';
import {
  DEFAULT_AS_OF_DATE,
  DEFAULT_REPORT_YEAR,
  INITIAL_REGISTER_DATA,
} from './data/seedData';
import { computeRegisterSummary } from './utils/calculations';
import { UI_TEXT } from './utils/i18n';
import { SummaryView } from './components/SummaryView';
import { NttnRegisterView } from './components/NttnRegisterView';
import { ChangesView } from './components/ChangesView';
import { SetupView } from './components/SetupView';
import { TemporaryView } from './components/TemporaryView';
import { DispatchChannelTab, ReportsView } from './components/ReportsView';
import { ChangeModal } from './components/ChangeModal';
import { LinkModal } from './components/LinkModal';

const STORAGE_KEY = 'speednet_capacity_register_v2';

function loadStoredData(): RegisterData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_REGISTER_DATA;
    const parsed = JSON.parse(raw) as RegisterData;
    if (
      Array.isArray(parsed.providers) &&
      Array.isArray(parsed.links) &&
      Array.isArray(parsed.changes)
    ) {
      return parsed;
    }
    return INITIAL_REGISTER_DATA;
  } catch {
    return INITIAL_REGISTER_DATA;
  }
}

export default function App() {
  const [data, setData] = useState<RegisterData>(loadStoredData);
  const [asOfDate, setAsOfDate] = useState<string>(DEFAULT_AS_OF_DATE);
  const [reportYear, setReportYear] = useState<number>(DEFAULT_REPORT_YEAR);
  const [activeTab, setActiveTab] = useState<ActiveTab>('nttn');
  const [lang, setLang] = useState<Language>('bn');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Drill-down filter state when navigating from Summary
  const [setupProviderFocus, setSetupProviderFocus] = useState<string>('ALL');
  const [changesStatusFocus, setChangesStatusFocus] = useState<ChangeStatus | 'ALL'>('ALL');
  const [changesViewKey, setChangesViewKey] = useState(0);
  const [setupViewKey, setSetupViewKey] = useState(0);
  const [reportChannel, setReportChannel] = useState<DispatchChannelTab>('print');

  const openDispatchReport = (channel: DispatchChannelTab) => {
    setReportChannel(channel);
    setActiveTab('reports');
  };

  // Change Modal state
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [editingChange, setEditingChange] = useState<CapacityChange | null>(null);
  const [presetReturnFor, setPresetReturnFor] = useState<CapacityChange | null>(null);
  const [presetLinkId, setPresetLinkId] = useState<string | undefined>(undefined);
  const [presetChangeType, setPresetChangeType] = useState<ChangeType | undefined>(undefined);

  // Link Add/Edit Modal state (shared across NTTN Register & Setup)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<NetworkLink | null>(null);
  const [linkModalDefaultCategory, setLinkModalDefaultCategory] = useState<
    'Upstream' | 'NTTN' | undefined
  >(undefined);
  const [linkModalDefaultProviderId, setLinkModalDefaultProviderId] = useState<
    string | undefined
  >(undefined);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }, [data]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 3000);
  };

  const summary = useMemo(
    () => computeRegisterSummary(data, asOfDate, reportYear),
    [data, asOfDate, reportYear]
  );

  const t = UI_TEXT[lang];

  const availableYears = useMemo(() => {
    const set = new Set<number>([2025, 2026, 2027, reportYear]);
    data.changes.forEach((c) => {
      const y = Number(c.effectiveDate?.slice(0, 4));
      if (y >= 2020 && y <= 2035) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [data.changes, reportYear]);

  // Handlers for Capacity Changes
  const openNewChangeModal = (type?: ChangeType, linkId?: string) => {
    setEditingChange(null);
    setPresetReturnFor(null);
    setPresetLinkId(linkId);
    setPresetChangeType(type);
    setChangeModalOpen(true);
  };

  const openEditChangeModal = (change: CapacityChange) => {
    setEditingChange(change);
    setPresetReturnFor(null);
    setPresetLinkId(undefined);
    setPresetChangeType(undefined);
    setChangeModalOpen(true);
  };

  const openRecordReturnModal = (tempUpgrade: CapacityChange) => {
    setEditingChange(null);
    setPresetReturnFor(tempUpgrade);
    setPresetLinkId(tempUpgrade.linkId);
    setPresetChangeType('Temporary Return');
    setChangeModalOpen(true);
  };

  // Handlers for Link Modal
  const openAddLinkModal = (category?: 'Upstream' | 'NTTN', providerId?: string) => {
    setEditingLink(null);
    setLinkModalDefaultCategory(category);
    setLinkModalDefaultProviderId(providerId);
    setLinkModalOpen(true);
  };

  const openEditLinkModal = (link: NetworkLink) => {
    setEditingLink(link);
    setLinkModalDefaultCategory(undefined);
    setLinkModalDefaultProviderId(undefined);
    setLinkModalOpen(true);
  };

  const handleSaveChange = (
    payload: Omit<CapacityChange, 'id' | 'changeCode' | 'createdAt'>,
    editingId?: string
  ) => {
    if (editingId) {
      setData((prev) => ({
        ...prev,
        changes: prev.changes.map((c) => (c.id === editingId ? { ...c, ...payload } : c)),
      }));
      showToast(lang === 'bn' ? 'পরিবর্তন আপডেট হয়েছে।' : 'Change entry updated.');
    } else {
      const yearPrefix = payload.effectiveDate.slice(0, 4) || String(reportYear);
      const nextNum = data.changes.length + 1;
      const code = `CHG-${yearPrefix}-${String(nextNum).padStart(3, '0')}`;
      const newEntry: CapacityChange = {
        ...payload,
        id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        changeCode: code,
        createdAt: new Date().toISOString(),
      };
      setData((prev) => ({
        ...prev,
        changes: [newEntry, ...prev.changes],
      }));
      showToast(
        lang === 'bn'
          ? `${code} রেজিস্টারে যুক্ত হয়েছে।`
          : `${code} logged to Capacity Register.`
      );
    }
  };

  const handleDeleteChange = (changeId: string) => {
    setData((prev) => ({
      ...prev,
      changes: prev.changes.filter((c) => c.id !== changeId),
    }));
    showToast(lang === 'bn' ? 'এন্ট্রি মুছে ফেলা হয়েছে।' : 'Change entry deleted.');
  };

  const handleQuickComplete = (changeId: string) => {
    setData((prev) => ({
      ...prev,
      changes: prev.changes.map((c) =>
        c.id === changeId ? { ...c, status: 'Completed' } : c
      ),
    }));
    showToast(lang === 'bn' ? 'এন্ট্রি Completed হিসেবে চিহ্নিত হয়েছে।' : 'Marked as Completed.');
  };

  // Handlers for Setup (Providers & Links)
  const handleSaveProvider = (payload: Omit<Provider, 'id'>, editingId?: string) => {
    if (editingId) {
      setData((prev) => ({
        ...prev,
        providers: prev.providers.map((p) => (p.id === editingId ? { ...p, ...payload } : p)),
      }));
      showToast(lang === 'bn' ? 'Provider তথ্য আপডেট হয়েছে।' : 'Provider updated.');
    } else {
      const newProv: Provider = {
        ...payload,
        id: `prov-${Date.now()}`,
      };
      setData((prev) => ({ ...prev, providers: [...prev.providers, newProv] }));
      showToast(lang === 'bn' ? 'নতুন Provider যোগ হয়েছে।' : 'Provider added.');
    }
  };

  const handleDeleteProvider = (providerId: string) => {
    setData((prev) => ({
      ...prev,
      providers: prev.providers.filter((p) => p.id !== providerId),
    }));
    showToast(lang === 'bn' ? 'Provider মুছে ফেলা হয়েছে।' : 'Provider removed.');
  };

  const handleSaveLink = (payload: Omit<NetworkLink, 'id'>, editingId?: string) => {
    if (editingId) {
      setData((prev) => ({
        ...prev,
        links: prev.links.map((l) => (l.id === editingId ? { ...l, ...payload } : l)),
      }));
      showToast(lang === 'bn' ? 'লিংক তথ্য আপডেট হয়েছে।' : 'Link updated.');
    } else {
      const newLink: NetworkLink = {
        ...payload,
        id: `lnk-${Date.now()}`,
      };
      setData((prev) => ({ ...prev, links: [...prev.links, newLink] }));
      showToast(lang === 'bn' ? 'নতুন লিংক যোগ হয়েছে।' : 'Link added.');
    }
  };

  const handleDeleteLink = (linkId: string) => {
    setData((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l.id !== linkId),
    }));
    showToast(lang === 'bn' ? 'লিংক মুছে ফেলা হয়েছে।' : 'Link deleted.');
  };

  const handleImportJson = (imported: RegisterData) => {
    setData(imported);
    showToast(lang === 'bn' ? 'ব্যাকআপ সফলভাবে ইমপোর্ট হয়েছে।' : 'Backup restored successfully.');
  };

  const handleResetToSeed = () => {
    setData(INITIAL_REGISTER_DATA);
    setAsOfDate(DEFAULT_AS_OF_DATE);
    setReportYear(DEFAULT_REPORT_YEAR);
    showToast(
      lang === 'bn'
        ? 'SpeedNet-এর মূল ডেটা পুনরুদ্ধার হয়েছে।'
        : 'Reset to original SpeedNet Capacity Register data.'
    );
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    counter?: number;
    alert?: boolean;
  }[] = [
    { id: 'summary', label: t.nav.summary, icon: LayoutDashboard },
    {
      id: 'nttn',
      label: t.nav.nttn,
      icon: Cable,
      counter: summary.nttnLinkCount,
    },
    {
      id: 'changes',
      label: t.nav.changes,
      icon: ArrowLeftRight,
      counter: data.changes.length,
    },
    {
      id: 'setup',
      label: t.nav.setup,
      icon: Network,
      counter: data.links.filter((l) => l.active).length,
    },
    {
      id: 'temporary',
      label: t.nav.temporary,
      icon: Clock,
      counter: summary.openTempTotalCount,
      alert: summary.overdueTempTotalCount > 0,
    },
    { id: 'reports', label: t.nav.reports, icon: FileBarChart2 },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label || t.nav.summary;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden no-print"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-62 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('summary');
              setMobileMenuOpen(false);
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            SpeedNet
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-700 lg:hidden cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-white' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.counter !== undefined && item.counter > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      item.alert
                        ? active
                          ? 'text-red-300 font-semibold'
                          : 'text-red-700 font-semibold'
                        : active
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.counter}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Upstream</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {summary.upstreamTotalMbps.toLocaleString('en-US')} Mbps
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>NTTN</span>
              <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                {summary.nttnTotalMbps.toLocaleString('en-US')} Mbps
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setLang('bn')}
              className={`py-1 text-xs font-medium transition-colors cursor-pointer ${
                lang === 'bn'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`py-1 text-xs font-medium transition-colors cursor-pointer ${
                lang === 'en'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5 lg:px-8 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Capacity Register
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate whitespace-nowrap">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <label className="flex items-center gap-2 border border-amber-300 bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-950">
              <Calendar className="h-3.5 w-3.5 text-amber-800 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline font-medium whitespace-nowrap">
                {t.topbar.asOfDate}:
              </span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setAsOfDate(val);
                    const y = Number(val.slice(0, 4));
                    if (y >= 2020 && y <= 2035) setReportYear(y);
                  }
                }}
                aria-label={t.topbar.asOfDate}
                className="bg-transparent font-mono text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
              />
            </label>

            <select
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
              aria-label={t.topbar.reportYear}
              className="border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => openNewChangeModal()}
              className="inline-flex items-center gap-1.5 bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t.topbar.logChange}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'summary' && (
            <SummaryView
              summary={summary}
              lang={lang}
              onInspectProvider={(providerId) => {
                const prov = data.providers.find((p) => p.id === providerId);
                if (prov?.category === 'NTTN') {
                  setActiveTab('nttn');
                } else {
                  setSetupProviderFocus(providerId);
                  setSetupViewKey((k) => k + 1);
                  setActiveTab('setup');
                }
              }}
              onOpenTemporaryTab={() => setActiveTab('temporary')}
              onOpenChangesTab={(status) => {
                setChangesStatusFocus(status || 'ALL');
                setChangesViewKey((k) => k + 1);
                setActiveTab('changes');
              }}
              onOpenSetupTab={() => {
                setSetupProviderFocus('ALL');
                setSetupViewKey((k) => k + 1);
                setActiveTab('setup');
              }}
              onOpenDispatchReport={openDispatchReport}
            />
          )}

          {activeTab === 'nttn' && (
            <NttnRegisterView
              data={data}
              summary={summary}
              lang={lang}
              onAddNttnLink={() => openAddLinkModal('NTTN')}
              onEditLink={openEditLinkModal}
              onQuickChangeForLink={(linkId, type) => openNewChangeModal(type, linkId)}
              onEditChange={openEditChangeModal}
              onQuickComplete={handleQuickComplete}
              onRecordReturn={openRecordReturnModal}
              onOpenDispatchReport={openDispatchReport}
            />
          )}

          {activeTab === 'changes' && (
            <ChangesView
              key={changesViewKey}
              data={data}
              summary={summary}
              lang={lang}
              initialStatusFilter={changesStatusFocus}
              onAddChange={() => openNewChangeModal()}
              onEditChange={openEditChangeModal}
              onDeleteChange={handleDeleteChange}
              onQuickComplete={handleQuickComplete}
              onRecordReturn={openRecordReturnModal}
            />
          )}

          {activeTab === 'setup' && (
            <SetupView
              key={setupViewKey}
              data={data}
              summary={summary}
              lang={lang}
              initialProviderId={setupProviderFocus}
              onSaveProvider={handleSaveProvider}
              onDeleteProvider={handleDeleteProvider}
              onAddLink={(providerId) => openAddLinkModal(undefined, providerId)}
              onEditLink={openEditLinkModal}
              onDeleteLink={handleDeleteLink}
              onQuickChangeForLink={(linkId, type) => openNewChangeModal(type, linkId)}
            />
          )}

          {activeTab === 'temporary' && (
            <TemporaryView
              summary={summary}
              lang={lang}
              onLogTempUpgrade={() => openNewChangeModal('Temporary Upgrade')}
              onRecordReturn={openRecordReturnModal}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              data={data}
              summary={summary}
              lang={lang}
              initialChannel={reportChannel}
              onImportJson={handleImportJson}
              onResetToSeed={handleResetToSeed}
            />
          )}
        </main>
      </div>

      {/* Add/Edit Capacity Change Modal */}
      <ChangeModal
        isOpen={changeModalOpen}
        lang={lang}
        data={data}
        summary={summary}
        asOfDate={asOfDate}
        editingChange={editingChange}
        presetReturnFor={presetReturnFor}
        presetLinkId={presetLinkId}
        presetType={presetChangeType}
        onClose={() => setChangeModalOpen(false)}
        onSave={handleSaveChange}
      />

      {/* Add/Edit Link Modal */}
      <LinkModal
        isOpen={linkModalOpen}
        lang={lang}
        providers={data.providers}
        editingLink={editingLink}
        defaultCategory={linkModalDefaultCategory}
        defaultProviderId={linkModalDefaultProviderId}
        onClose={() => setLinkModalOpen(false)}
        onSave={handleSaveLink}
      />

      {/* Clean Transient Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg no-print"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
