import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ChangeType,
  ComputedRegisterSummary,
  Language,
  NetworkLink,
  Provider,
  ProviderCategory,
  RegisterData,
} from '../types/register';
import { formatDateDMY, formatMbps } from '../utils/calculations';
import { UI_TEXT } from '../utils/i18n';

interface SetupViewProps {
  data: RegisterData;
  summary: ComputedRegisterSummary;
  lang: Language;
  initialProviderId?: string;
  onSaveProvider: (provider: Omit<Provider, 'id'>, editingId?: string) => void;
  onDeleteProvider: (providerId: string) => void;
  onAddLink: (defaultProviderId?: string) => void;
  onEditLink: (link: NetworkLink) => void;
  onDeleteLink: (linkId: string) => void;
  onQuickChangeForLink: (linkId: string, type: ChangeType) => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  data,
  summary,
  lang,
  initialProviderId = 'ALL',
  onSaveProvider,
  onDeleteProvider,
  onAddLink,
  onEditLink,
  onDeleteLink,
  onQuickChangeForLink,
}) => {
  const t = UI_TEXT[lang];
  const [subTab, setSubTab] = useState<'links' | 'providers'>('links');
  const [providerFilter, setProviderFilter] = useState<string>(initialProviderId);
  const [categoryFilter, setCategoryFilter] = useState<ProviderCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  // Provider Modal state
  const [provModalOpen, setProvModalOpen] = useState(false);
  const [editingProv, setEditingProv] = useState<Provider | null>(null);
  const [provName, setProvName] = useState('');
  const [provCat, setProvCat] = useState<ProviderCategory>('Upstream');
  const [provContact, setProvContact] = useState('');
  const [provNotes, setProvNotes] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const provMap = useMemo(() => new Map(data.providers.map((p) => [p.id, p])), [data.providers]);

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.links.filter((lnk) => {
      const prov = provMap.get(lnk.providerId);
      if (providerFilter !== 'ALL' && lnk.providerId !== providerFilter) return false;
      if (categoryFilter !== 'ALL' && prov?.category !== categoryFilter) return false;
      if (q) {
        const hay = [
          lnk.circuitId,
          lnk.providerLinkId || '',
          lnk.name,
          lnk.service,
          lnk.popLocation,
          lnk.statusNote || '',
          prov?.name || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.links, provMap, providerFilter, categoryFilter, search]);

  const openAddProvider = () => {
    setEditingProv(null);
    setProvName('');
    setProvCat('Upstream');
    setProvContact('');
    setProvNotes('');
    setProvModalOpen(true);
  };

  const openEditProvider = (prov: Provider) => {
    setEditingProv(prov);
    setProvName(prov.name);
    setProvCat(prov.category);
    setProvContact(prov.contactPerson || '');
    setProvNotes(prov.notes || '');
    setProvModalOpen(true);
  };

  const submitProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName.trim()) return;
    onSaveProvider(
      {
        name: provName.trim(),
        category: provCat,
        contactPerson: provContact.trim() || undefined,
        notes: provNotes.trim() || undefined,
      },
      editingProv?.id
    );
    setProvModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Sub-tab Switch */}
      <div className="border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t.setup.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.setup.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAddProvider}
              className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t.setup.addProvider}
            </button>
            <button
              type="button"
              onClick={() => onAddLink(providerFilter !== 'ALL' ? providerFilter : undefined)}
              className="inline-flex items-center gap-1.5 bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t.setup.addLink}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="inline-flex items-center gap-1 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSubTab('links')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'links'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.setup.linksTab} ({data.links.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('providers')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                subTab === 'providers'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.setup.providersTab} ({data.providers.length})
            </button>
          </div>

          {subTab === 'links' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Link Key / Link ID / POP..."
                  className="border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ProviderCategory | 'ALL')}
                className="border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                <option value="ALL">{t.changes.allCategories}</option>
                <option value="Upstream">Upstream</option>
                <option value="NTTN">NTTN</option>
              </select>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                <option value="ALL">All Providers</option>
                {data.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Links Table */}
      {subTab === 'links' && (
        <div className="border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">{t.setup.colCircuit}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t.setup.colLinkName}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t.summary.colProvider}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t.summary.colService}</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">{t.setup.colInitial}</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">{t.setup.colNetChange}</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">{t.setup.colCurrent}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t.setup.colState}</th>
                <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">{t.changes.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLinks.map((lnk) => {
                const prov = provMap.get(lnk.providerId);
                const state = summary.linkStates[lnk.id];
                const netDelta = state ? state.netChangeMbps : 0;
                const current = state ? state.currentMbps : lnk.initialMbps;

                return (
                  <tr
                    key={lnk.id}
                    className={`min-h-11 hover:bg-slate-50 ${!lnk.active ? 'opacity-60' : ''}`}
                  >
                    <td className="py-2 pl-5 pr-3 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {lnk.circuitId}
                      </div>
                      {lnk.providerLinkId && (
                        <div className="font-mono text-[11px] text-slate-500">
                          {lnk.providerLinkId}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[260px]">
                      <div className="truncate text-xs font-medium text-slate-900">
                        {lnk.popLocation || lnk.name}
                      </div>
                      <div className="truncate font-mono text-[11px] text-slate-500">
                        {formatDateDMY(lnk.startDate)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {prov?.name || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap">
                      <span
                        className={
                          lnk.service === 'NTTN' ? 'text-emerald-800' : 'text-blue-800'
                        }
                      >
                        {lnk.service}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatMbps(lnk.initialMbps)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                        netDelta > 0
                          ? 'text-emerald-700 font-medium'
                          : netDelta < 0
                          ? 'text-red-700 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {netDelta === 0
                        ? '—'
                        : `${netDelta > 0 ? '+' : '−'}${formatMbps(Math.abs(netDelta))}`}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                        current < 0 ? 'text-red-700' : 'text-slate-900'
                      }`}
                    >
                      {formatMbps(current)}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <span className={lnk.active ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                        {lnk.statusNote || (lnk.active ? t.setup.active : t.setup.inactive)}
                      </span>
                    </td>
                    <td className="py-2 pl-3 pr-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onQuickChangeForLink(lnk.id, 'Upgrade')}
                          title="Upgrade (+)"
                          className="p-1 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          aria-label="Upgrade"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickChangeForLink(lnk.id, 'Downgrade')}
                          title="Downgrade (−)"
                          className="p-1 text-red-700 hover:bg-red-50 cursor-pointer"
                          aria-label="Downgrade"
                        >
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onQuickChangeForLink(lnk.id, 'Temporary Upgrade')}
                          title="Temporary Upgrade"
                          className="p-1 text-amber-800 hover:bg-amber-50 cursor-pointer"
                          aria-label="Temporary Upgrade"
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditLink(lnk)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          aria-label={t.setup.edit}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {confirmDeleteId === lnk.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteLink(lnk.id);
                              setConfirmDeleteId(null);
                            }}
                            onBlur={() => setConfirmDeleteId(null)}
                            className="bg-red-700 px-2 py-1 text-[11px] font-medium text-white cursor-pointer"
                          >
                            {lang === 'bn' ? 'নিশ্চিত?' : 'Confirm?'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(lnk.id)}
                            className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            aria-label={t.setup.delete}
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

      {/* Providers Table */}
      {subTab === 'providers' && (
        <div className="border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-2.5 pl-5 pr-3">{t.summary.colProvider}</th>
                <th className="px-3 py-2.5">{t.summary.colType}</th>
                <th className="px-3 py-2.5">{lang === 'bn' ? 'যোগাযোগ / নোট' : 'Contact & Notes'}</th>
                <th className="px-3 py-2.5 text-right">{t.summary.colLinks}</th>
                <th className="px-3 py-2.5 text-right">{t.setup.colCurrent}</th>
                <th className="py-2.5 pl-3 pr-5 text-right">{t.changes.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.providerRows.map((row) => (
                <tr key={row.provider.id} className="h-12 hover:bg-slate-50">
                  <td className="py-2.5 pl-5 pr-3 font-semibold text-slate-900 text-xs">
                    {row.provider.name}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span
                      className={
                        row.provider.category === 'NTTN'
                          ? 'font-medium text-emerald-800'
                          : 'font-medium text-blue-800'
                      }
                    >
                      {row.provider.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    <div>{row.provider.contactPerson || '—'}</div>
                    {row.provider.notes && (
                      <div className="text-[11px] text-slate-400">{row.provider.notes}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                    {row.linkCount}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {formatMbps(row.totalMbps)} Mbps
                  </td>
                  <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditProvider(row.provider)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        aria-label={t.setup.edit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {row.linkCount === 0 && (
                        <button
                          type="button"
                          onClick={() => onDeleteProvider(row.provider.id)}
                          className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          aria-label={t.setup.delete}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider Add/Edit Modal */}
      {provModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingProv
                  ? lang === 'bn'
                    ? 'Provider সম্পাদনা'
                    : 'Edit Provider'
                  : t.setup.addProvider}
              </h3>
              <button
                type="button"
                onClick={() => setProvModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitProvider} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provider Name
                </label>
                <input
                  type="text"
                  required
                  value={provName}
                  onChange={(e) => setProvName(e.target.value)}
                  placeholder="e.g. Summit Communication Ltd."
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.summary.colType}
                </label>
                <select
                  value={provCat}
                  onChange={(e) => setProvCat(e.target.value as ProviderCategory)}
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
                >
                  <option value="Upstream">Upstream (IIG / GGC / FNA / CDN / BDIX / PNI)</option>
                  <option value="NTTN">NTTN (Transmission)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'bn' ? 'যোগাযোগ / NOC ডেস্ক' : 'Contact / NOC Desk'}
                </label>
                <input
                  type="text"
                  value={provContact}
                  onChange={(e) => setProvContact(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'bn' ? 'মন্তব্য' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={provNotes}
                  onChange={(e) => setProvNotes(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProvModalOpen(false)}
                  className="border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t.modal.cancel}
                </button>
                <button
                  type="submit"
                  className="bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  {t.modal.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
