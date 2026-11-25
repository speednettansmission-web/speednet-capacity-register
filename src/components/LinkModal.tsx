import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  Language,
  NetworkLink,
  Provider,
  ServiceType,
  UPSTREAM_SERVICES,
} from '../types/register';
import { UI_TEXT } from '../utils/i18n';

interface LinkModalProps {
  isOpen: boolean;
  lang: Language;
  providers: Provider[];
  editingLink: NetworkLink | null;
  defaultCategory?: 'Upstream' | 'NTTN';
  defaultProviderId?: string;
  onClose: () => void;
  onSave: (link: Omit<NetworkLink, 'id'>, editingId?: string) => void;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  lang,
  providers,
  editingLink,
  defaultCategory,
  defaultProviderId,
  onClose,
  onSave,
}) => {
  const t = UI_TEXT[lang];
  const provMap = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);

  const [circuitId, setCircuitId] = useState('');
  const [providerLinkId, setProviderLinkId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [providerId, setProviderId] = useState('');
  const [service, setService] = useState<ServiceType>('NTTN');
  const [popLocation, setPopLocation] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [initialMbps, setInitialMbps] = useState('1000');
  const [statusNote, setStatusNote] = useState('Active');
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingLink) {
      setCircuitId(editingLink.circuitId);
      setProviderLinkId(editingLink.providerLinkId || '');
      setCustomerName(editingLink.customerName || '');
      setProviderId(editingLink.providerId);
      setService(editingLink.service);
      setPopLocation(editingLink.popLocation || editingLink.name);
      setStartDate(editingLink.startDate);
      setInitialMbps(String(editingLink.initialMbps));
      setStatusNote(editingLink.statusNote || (editingLink.active ? 'Active' : 'Inactive'));
      setActive(editingLink.active);
      setNotes(editingLink.notes || '');
    } else {
      const preferredProv =
        (defaultProviderId && provMap.get(defaultProviderId)) ||
        (defaultCategory
          ? providers.find((p) => p.category === defaultCategory)
          : providers[0]) ||
        providers[0];
      setCircuitId('');
      setProviderLinkId('');
      setCustomerName('');
      setProviderId(preferredProv?.id || '');
      setService(preferredProv?.category === 'NTTN' ? 'NTTN' : 'IIG');
      setPopLocation('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setInitialMbps('500');
      setStatusNote('Active');
      setActive(true);
      setNotes('');
    }
  }, [isOpen, editingLink, defaultCategory, defaultProviderId, providers, provMap]);

  if (!isOpen) return null;

  const selectedProv = provMap.get(providerId);
  const allowedServices: ServiceType[] =
    selectedProv?.category === 'NTTN' ? ['NTTN'] : UPSTREAM_SERVICES;

  const handleProviderChange = (newId: string) => {
    setProviderId(newId);
    const p = provMap.get(newId);
    if (p?.category === 'NTTN') {
      setService('NTTN');
    } else if (service === 'NTTN') {
      setService('IIG');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(initialMbps);
    if (!circuitId.trim() || !popLocation.trim() || !providerId || Number.isNaN(num) || num < 0) {
      return;
    }
    onSave(
      {
        circuitId: circuitId.trim(),
        providerLinkId: providerLinkId.trim() || undefined,
        customerName: customerName.trim() || undefined,
        name: popLocation.trim(),
        providerId,
        service,
        popLocation: popLocation.trim(),
        startDate,
        initialMbps: num,
        active,
        statusNote: statusNote.trim() || (active ? 'Active' : 'Inactive'),
        notes: notes.trim() || undefined,
      },
      editingLink?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl border border-slate-200 bg-white shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingLink
              ? lang === 'bn'
                ? 'লিংক তথ্য সম্পাদনা করুন'
                : 'Edit Link Details'
              : defaultCategory === 'NTTN'
              ? t.nttn.addNttnLink
              : t.setup.addLink}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link Key
              </label>
              <input
                type="text"
                required
                value={circuitId}
                onChange={(e) => setCircuitId(e.target.value)}
                placeholder="e.g. NTTN-SCOMM-16"
                className="w-full border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link ID ({lang === 'bn' ? 'প্রোভাইডার সার্কিট আইডি' : 'Provider Circuit ID'})
              </label>
              <input
                type="text"
                value={providerLinkId}
                onChange={(e) => setProviderLinkId(e.target.value)}
                placeholder="e.g. spnt_281026_296_nt_05 / 155148"
                className="w-full border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Provider
              </label>
              <select
                value={providerId}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType)}
                className="w-full border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-700 focus:outline-none"
              >
                {allowedServices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.nttn.colRoute}
              </label>
              <input
                type="text"
                required
                value={popLocation}
                onChange={(e) => setPopLocation(e.target.value)}
                placeholder="e.g. Khulna-1 – Chuadanga"
                className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'bn'
                  ? 'গ্রাহক / কাস্টমার নাম (ঐচ্ছিক)'
                  : 'Customer / Client Name (Optional)'}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'যেমন: M/S. Speed Net / POP / কর্পোরেট ক্লায়েন্ট'
                    : 'e.g. M/S. Speed Net / Corporate Client'
                }
                className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.nttn.colStartDate}
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.setup.colInitial}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={initialMbps}
                onChange={(e) => setInitialMbps(e.target.value)}
                className="w-full border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.nttn.colStatusNote}
              </label>
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Active / Active (Core) / Dark core"
                className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-blue-700"
              />
              {lang === 'bn'
                ? 'সক্রিয় লিংক (মোট ক্যাপাসিটিতে গণনা হবে)'
                : 'Active link (included in total capacity)'}
            </label>
            {editingLink && (
              <span className="text-[11px] text-slate-500">
                {lang === 'bn'
                  ? 'ক্যাপাসিটি বাড়াতে/কমাতে Upgrade বা Downgrade বাটন ব্যবহার করুন।'
                  : 'Use Upgrade / Downgrade actions to log dated capacity changes.'}
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
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
  );
};
