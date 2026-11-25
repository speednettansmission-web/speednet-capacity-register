import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  CapacityChange,
  ChangeStatus,
  ChangeType,
  ComputedRegisterSummary,
  Language,
  RegisterData,
} from '../types/register';
import {
  computeLinkCapacityAtDate,
  formatMbps,
  getSignedDelta,
} from '../utils/calculations';
import { UI_TEXT } from '../utils/i18n';

interface ChangeModalProps {
  isOpen: boolean;
  lang: Language;
  data: RegisterData;
  summary: ComputedRegisterSummary;
  asOfDate: string;
  editingChange: CapacityChange | null;
  presetReturnFor: CapacityChange | null;
  presetLinkId?: string;
  presetType?: ChangeType;
  onClose: () => void;
  onSave: (change: Omit<CapacityChange, 'id' | 'changeCode' | 'createdAt'>, editingId?: string) => void;
}

export const ChangeModal: React.FC<ChangeModalProps> = ({
  isOpen,
  lang,
  data,
  summary,
  asOfDate,
  editingChange,
  presetReturnFor,
  presetLinkId,
  presetType,
  onClose,
  onSave,
}) => {
  const t = UI_TEXT[lang];

  const activeLinks = useMemo(
    () => data.links.filter((l) => l.active),
    [data.links]
  );
  const provMap = useMemo(
    () => new Map(data.providers.map((p) => [p.id, p])),
    [data.providers]
  );

  const openTempOptions = useMemo(() => {
    return summary.temporaryItems.filter(
      (item) => item.isOpen || item.change.id === editingChange?.relatedChangeId
    );
  }, [summary.temporaryItems, editingChange]);

  const [linkId, setLinkId] = useState('');
  const [changeType, setChangeType] = useState<ChangeType>('Upgrade');
  const [effectiveDate, setEffectiveDate] = useState(asOfDate);
  const [amountMbps, setAmountMbps] = useState<string>('');
  const [status, setStatus] = useState<ChangeStatus>('Completed');
  const [returnDueDate, setReturnDueDate] = useState('');
  const [relatedChangeId, setRelatedChangeId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);

    if (editingChange) {
      setLinkId(editingChange.linkId);
      setChangeType(editingChange.changeType);
      setEffectiveDate(editingChange.effectiveDate);
      setAmountMbps(String(editingChange.amountMbps));
      setStatus(editingChange.status);
      setReturnDueDate(editingChange.returnDueDate || '');
      setRelatedChangeId(editingChange.relatedChangeId || '');
      setReferenceNo(editingChange.referenceNo || '');
      setRemarks(editingChange.remarks || '');
    } else if (presetReturnFor) {
      const tracker = summary.temporaryItems.find(
        (item) => item.change.id === presetReturnFor.id
      );
      setLinkId(presetReturnFor.linkId);
      setChangeType('Temporary Return');
      setEffectiveDate(asOfDate);
      setAmountMbps(String(tracker ? tracker.remainingMbps : presetReturnFor.amountMbps));
      setStatus('Completed');
      setReturnDueDate('');
      setRelatedChangeId(presetReturnFor.id);
      setReferenceNo(presetReturnFor.referenceNo ? `RET-${presetReturnFor.referenceNo}` : '');
      setRemarks(`Return of ${presetReturnFor.changeCode}`);
    } else {
      setLinkId(presetLinkId || activeLinks[0]?.id || '');
      setChangeType(presetType || 'Upgrade');
      setEffectiveDate(asOfDate);
      setAmountMbps('');
      setStatus('Completed');
      setReturnDueDate('');
      setRelatedChangeId('');
      setReferenceNo('');
      setRemarks('');
    }
  }, [
    isOpen,
    editingChange,
    presetReturnFor,
    presetLinkId,
    presetType,
    asOfDate,
    activeLinks,
    summary.temporaryItems,
  ]);

  const handleSelectRelatedTemp = (tempId: string) => {
    setRelatedChangeId(tempId);
    const match = openTempOptions.find((o) => o.change.id === tempId);
    if (match) {
      setLinkId(match.change.linkId);
      setAmountMbps(String(match.remainingMbps));
    }
  };

  const selectedLink = useMemo(
    () => data.links.find((l) => l.id === linkId),
    [data.links, linkId]
  );

  const parsedAmount = Number(amountMbps) || 0;
  const signedDelta = getSignedDelta(changeType, parsedAmount);

  const beforeCapacity = useMemo(() => {
    if (!selectedLink || !effectiveDate) return 0;
    return computeLinkCapacityAtDate(
      selectedLink,
      data.changes,
      effectiveDate,
      editingChange?.id
    );
  }, [selectedLink, data.changes, effectiveDate, editingChange]);

  const afterCapacity =
    status === 'Completed' ? beforeCapacity + signedDelta : beforeCapacity;
  const willBeNegative = status === 'Completed' && afterCapacity < 0;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkId) {
      setFormError(lang === 'bn' ? 'একটি লিংক নির্বাচন করুন।' : 'Please select a link.');
      return;
    }
    if (!effectiveDate) {
      setFormError(lang === 'bn' ? 'কার্যকর তারিখ দিন।' : 'Effective date is required.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(
        lang === 'bn'
          ? 'পরিবর্তনের অঙ্ক অবশ্যই ০-এর বেশি হতে হবে।'
          : 'Change amount must be greater than 0 Mbps.'
      );
      return;
    }
    if (changeType === 'Temporary Upgrade' && !returnDueDate) {
      setFormError(
        lang === 'bn'
          ? 'Temporary Upgrade-এর জন্য ফেরতের মেয়াদ (Return Due Date) দিতে হবে।'
          : 'Return Due Date is required for Temporary Upgrades.'
      );
      return;
    }
    if (changeType === 'Temporary Return' && !relatedChangeId) {
      setFormError(
        lang === 'bn'
          ? 'কোন Temporary Upgrade ফেরত দিচ্ছেন তা নির্বাচন করুন।'
          : 'Please select which Temporary Upgrade is being returned.'
      );
      return;
    }

    onSave(
      {
        effectiveDate,
        linkId,
        changeType,
        amountMbps: parsedAmount,
        status,
        returnDueDate: changeType === 'Temporary Upgrade' ? returnDueDate : undefined,
        relatedChangeId: changeType === 'Temporary Return' ? relatedChangeId : undefined,
        referenceNo: referenceNo.trim() || undefined,
        remarks: remarks.trim() || undefined,
      },
      editingChange?.id
    );
    onClose();
  };

  const upstreamLinks = activeLinks.filter((l) => l.service !== 'NTTN');
  const nttnLinks = activeLinks.filter((l) => l.service === 'NTTN');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-modal-title"
    >
      <div className="w-full max-w-2xl border border-slate-200 bg-white shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="change-modal-title" className="text-base font-semibold text-slate-900">
            {editingChange ? t.modal.editTitle : t.modal.addTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
              {formError}
            </div>
          )}

          {/* Change Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t.modal.changeType}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                ['Upgrade', 'Downgrade', 'Temporary Upgrade', 'Temporary Return'] as ChangeType[]
              ).map((ct) => {
                const active = changeType === ct;
                const isUp = ct === 'Upgrade' || ct === 'Temporary Upgrade';
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setChangeType(ct)}
                    className={`border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? isUp
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-red-700 bg-red-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {ct}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temporary Return selector */}
          {changeType === 'Temporary Return' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.modal.relatedTemp}
              </label>
              <select
                value={relatedChangeId}
                onChange={(e) => handleSelectRelatedTemp(e.target.value)}
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                <option value="">
                  {lang === 'bn'
                    ? '— খোলা Temporary Upgrade নির্বাচন করুন —'
                    : '— Select an open Temporary Upgrade —'}
                </option>
                {openTempOptions.map((item) => (
                  <option key={item.change.id} value={item.change.id}>
                    {item.change.changeCode} · {item.link?.circuitId} ({item.link?.popLocation}) ·{' '}
                    {lang === 'bn' ? 'বাকি' : 'Open'}: {formatMbps(item.remainingMbps)} Mbps · Due:{' '}
                    {item.change.returnDueDate}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Link Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.modal.selectLink}
            </label>
            <select
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              disabled={changeType === 'Temporary Return' && Boolean(relatedChangeId)}
              className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-slate-100"
            >
              <optgroup label="NTTN Transmission Links (Summit & Fiber@Home)">
                {nttnLinks.map((lnk) => (
                  <option key={lnk.id} value={lnk.id}>
                    [NTTN] {lnk.circuitId}
                    {lnk.providerLinkId ? ` (${lnk.providerLinkId})` : ''} — {lnk.popLocation}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Upstream Bandwidth (IIG / GGC / FNA / BDIX / CDN / bCDN / PNI)">
                {upstreamLinks.map((lnk) => (
                  <option key={lnk.id} value={lnk.id}>
                    [{lnk.service}] {lnk.circuitId} — {lnk.name} ({provMap.get(lnk.providerId)?.name})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Core Numeric & Date Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.modal.effectiveDate}
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
                className="w-full border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.modal.amountMbps}
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={amountMbps}
                onChange={(e) => setAmountMbps(e.target.value)}
                placeholder="e.g. 400"
                required
                className="w-full border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.modal.status}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ChangeStatus)}
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                <option value="Completed">Completed</option>
                <option value="Requested">Requested</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Return Due Date (for Temporary Upgrade) */}
          {changeType === 'Temporary Upgrade' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.modal.returnDueDate}
                </label>
                <input
                  type="date"
                  value={returnDueDate}
                  min={effectiveDate}
                  onChange={(e) => setReturnDueDate(e.target.value)}
                  required
                  className="w-full border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div className="flex items-end pb-2 text-xs text-slate-500">
                {lang === 'bn'
                  ? 'মেয়াদ শেষে বাস্তবে ফেরত হলে আলাদা Completed Return এন্ট্রি দিতে হবে।'
                  : 'After this date, record a Completed Return once reduced in production.'}
              </div>
            </div>
          )}

          {/* Reference & Remarks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.modal.referenceNo}
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="WO-2026-041 / Mail Ref"
                className="w-full border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t.modal.remarks}
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'যেমন: 1000 থেকে 1400 Upgrade / পিক আওয়ার বৃদ্ধি'
                    : 'e.g. 1000 to 1400 Upgrade / Peak expansion'
                }
                className="w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Live Capacity Before -> After Preview */}
          {selectedLink && (
            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{t.modal.previewTitle}</span>
                <span className="font-mono text-slate-700">
                  {selectedLink.circuitId}
                  {selectedLink.providerLinkId ? ` · ${selectedLink.providerLinkId}` : ''} ·{' '}
                  {selectedLink.popLocation}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4 border-t border-slate-200 pt-3">
                <div>
                  <div className="text-[11px] text-slate-500">{t.modal.before}</div>
                  <div className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                    {formatMbps(beforeCapacity)} <span className="text-xs font-normal">Mbps</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t.modal.change}</div>
                  <div
                    className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${
                      status !== 'Completed'
                        ? 'text-slate-400'
                        : signedDelta >= 0
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {signedDelta >= 0 ? '+' : '−'}
                    {formatMbps(Math.abs(signedDelta))}{' '}
                    <span className="text-xs font-normal">Mbps</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t.modal.after}</div>
                  <div
                    className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${
                      willBeNegative ? 'text-red-700' : 'text-blue-800'
                    }`}
                  >
                    {formatMbps(afterCapacity)} <span className="text-xs font-normal">Mbps</span>
                  </div>
                </div>
              </div>

              {status !== 'Completed' && (
                <p className="mt-2.5 text-xs text-amber-800">{t.modal.statusNote}</p>
              )}
              {willBeNegative && (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t.modal.negativeWarn}
                </p>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t.modal.cancel}
            </button>
            <button
              type="submit"
              className="bg-blue-700 px-5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors cursor-pointer"
            >
              {t.modal.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
