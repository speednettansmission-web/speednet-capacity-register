import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  MessageCircle,
  Printer,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  ComputedRegisterSummary,
  Language,
  RegisterData,
  UPSTREAM_SERVICES,
} from '../types/register';
import {
  formatDateDMY,
  formatGbps,
  formatMbps,
  toDisplaySerial,
} from '../utils/calculations';
import {
  exportBackupJson,
  exportSummaryCsv,
  exportWorkbookXlsx,
} from '../utils/exportUtils';
import {
  buildDispatchReport,
  buildEmailReport,
  buildWhatsAppReportText,
  exportPeriodReportXlsx,
  formatLinkChangeSummary,
  ReportFrequency,
  ReportScopeOptions,
} from '../utils/reportFormatter';
import { MONTH_LABELS, UI_TEXT } from '../utils/i18n';

export type DispatchChannelTab = 'print' | 'whatsapp' | 'email';

interface ReportsViewProps {
  data: RegisterData;
  summary: ComputedRegisterSummary;
  lang: Language;
  initialChannel?: DispatchChannelTab;
  onImportJson: (imported: RegisterData) => void;
  onResetToSeed: () => void;
}

const CONTACT_STORAGE_KEY = 'speednet_report_contacts_v1';

interface SavedContacts {
  whatsappPhone: string;
  emailTo: string;
  emailCc: string;
}

function loadSavedContacts(): SavedContacts {
  try {
    const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
    if (!raw) return { whatsappPhone: '', emailTo: '', emailCc: '' };
    const parsed = JSON.parse(raw) as Partial<SavedContacts>;
    return {
      whatsappPhone: parsed.whatsappPhone || '',
      emailTo: parsed.emailTo || '',
      emailCc: parsed.emailCc || '',
    };
  } catch {
    return { whatsappPhone: '', emailTo: '', emailCc: '' };
  }
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  data,
  summary,
  lang,
  initialChannel = 'print',
  onImportJson,
  onResetToSeed,
}) => {
  const t = UI_TEXT[lang];
  const months = MONTH_LABELS[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [frequency, setFrequency] = useState<ReportFrequency>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    summary.asOfDate.slice(0, 7) || '2026-11'
  );
  const [selectedDate, setSelectedDate] = useState<string>(summary.asOfDate);
  const [channelTab, setChannelTab] = useState<DispatchChannelTab>(initialChannel);

  const [scope, setScope] = useState<ReportScopeOptions>({
    includeUpstream: true,
    includeNttn: true,
    includePeriodChanges: true,
    compactWhatsApp: false,
  });

  const [contacts, setContacts] = useState<SavedContacts>(loadSavedContacts);
  const [customWaText, setCustomWaText] = useState<string | null>(null);
  const [customEmailSubject, setCustomEmailSubject] = useState<string | null>(null);
  const [customEmailBody, setCustomEmailBody] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setChannelTab(initialChannel);
  }, [initialChannel]);

  useEffect(() => {
    try {
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contacts));
    } catch {
      // Ignore storage errors
    }
  }, [contacts]);

  // Reset custom text overrides when period, scope, data, or language changes
  useEffect(() => {
    setCustomWaText(null);
    setCustomEmailSubject(null);
    setCustomEmailBody(null);
  }, [frequency, selectedMonth, selectedDate, scope, lang, data]);

  const dispatchReport = useMemo(
    () => buildDispatchReport(data, frequency, selectedMonth, selectedDate),
    [data, frequency, selectedMonth, selectedDate]
  );

  const autoWaText = useMemo(
    () => buildWhatsAppReportText(dispatchReport, lang, scope),
    [dispatchReport, lang, scope]
  );
  const waText = customWaText ?? autoWaText;

  const autoEmail = useMemo(
    () => buildEmailReport(dispatchReport, lang, scope),
    [dispatchReport, lang, scope]
  );
  const emailSubject = customEmailSubject ?? autoEmail.subject;
  const emailBody = customEmailBody ?? autoEmail.body;

  const cleanedWaPhone = contacts.whatsappPhone.replace(/[^\d]/g, '');
  const waHref = cleanedWaPhone
    ? `https://wa.me/${cleanedWaPhone}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/?text=${encodeURIComponent(waText)}`;

  const mailtoParams = new URLSearchParams();
  if (contacts.emailCc.trim()) mailtoParams.set('cc', contacts.emailCc.trim());
  mailtoParams.set('subject', emailSubject);
  mailtoParams.set('body', emailBody);
  const mailtoHref = `mailto:${encodeURIComponent(contacts.emailTo.trim())}?${mailtoParams
    .toString()
    .replace(/\+/g, '%20')}`;

  const gmailParams = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: contacts.emailTo.trim(),
    su: emailSubject,
    body: emailBody,
  });
  if (contacts.emailCc.trim()) gmailParams.set('cc', contacts.emailCc.trim());
  const gmailHref = `https://mail.google.com/mail/?${gmailParams.toString()}`;

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2200);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const candidate: RegisterData = parsed.data ? parsed.data : parsed;
        if (
          !Array.isArray(candidate.providers) ||
          !Array.isArray(candidate.links) ||
          !Array.isArray(candidate.changes)
        ) {
          throw new Error('Invalid structure');
        }
        onImportJson(candidate);
      } catch {
        setImportError(
          lang === 'bn'
            ? 'বৈধ SpeedNet JSON ব্যাকআপ ফাইল নির্বাচন করুন।'
            : 'Please select a valid SpeedNet JSON backup file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Annual column sums (uses dispatchReport.summary year)
  const annualTotals = dispatchReport.summary.monthlyMovements.reduce(
    (acc, m) => ({
      upUp: acc.upUp + m.upstreamUpgrade + m.upstreamTempUp,
      upDown: acc.upDown + m.upstreamDowngrade + m.upstreamTempReturn,
      upNet: acc.upNet + m.upstreamNet,
      nttnUp: acc.nttnUp + m.nttnUpgrade + m.nttnTempUp,
      nttnDown: acc.nttnDown + m.nttnDowngrade + m.nttnTempReturn,
      nttnNet: acc.nttnNet + m.nttnNet,
      count: acc.count + m.completedCount,
    }),
    { upUp: 0, upDown: 0, upNet: 0, nttnUp: 0, nttnDown: 0, nttnNet: 0, count: 0 }
  );

  const periodHeading =
    lang === 'bn' ? dispatchReport.periodLabelBn : dispatchReport.periodLabelEn;
  const upstreamProviderRows = dispatchReport.summary.providerRows.filter(
    (r) => r.provider.category === 'Upstream'
  );
  const nttnProviderRows = dispatchReport.summary.providerRows.filter(
    (r) => r.provider.category === 'NTTN'
  );

  return (
    <div className="space-y-6">
      {/* 1. Report Builder & Dispatch Controls (No-Print) */}
      <section className="border border-slate-200 bg-white p-5 space-y-4 no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {lang === 'bn'
                ? 'দৈনিক / মাসিক রিপোর্ট তৈরি ও শেয়ার (Print / Email / WhatsApp)'
                : 'Daily & Monthly Report Builder (Print / Email / WhatsApp)'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {lang === 'bn'
                ? 'কোন Upstream Provider-এর কত ব্যান্ডউইথ চলছে, কোন NTTN Provider-এর ক্যাপাসিটি কোন গ্রাহক/POP-এ কত এবং Up/Down হয়েছে কি না তা প্রিন্ট, Email বা WhatsApp-এ পাঠান'
                : 'Generate and send Upstream provider capacity, NTTN provider & customer allocations, and period Up/Down changes via Print, Email, or WhatsApp'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setChannelTab('print');
                window.setTimeout(() => window.print(), 60);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              {t.reports.printReport}
            </button>
            <button
              type="button"
              onClick={() => exportPeriodReportXlsx(dispatchReport, lang)}
              className="inline-flex items-center gap-1.5 bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              {lang === 'bn' ? 'এই রিপোর্টের Excel (.xlsx)' : 'Period Excel (.xlsx)'}
            </button>
          </div>
        </div>

        {/* Period Frequency + Date/Month Selector + Scope Checkboxes */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Monthly vs Daily Switch */}
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setFrequency('monthly')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  frequency === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'bn' ? 'মাসিক রিপোর্ট' : 'Monthly Report'}
              </button>
              <button
                type="button"
                onClick={() => setFrequency('daily')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  frequency === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'bn' ? 'দৈনিক রিপোর্ট' : 'Daily Report'}
              </button>
            </div>

            {frequency === 'monthly' ? (
              <label className="inline-flex items-center gap-2 border border-amber-300 bg-amber-50/70 px-3 py-1.5 text-xs text-amber-950">
                <span className="font-medium whitespace-nowrap">
                  {lang === 'bn' ? 'মাস নির্বাচন:' : 'Month:'}
                </span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) setSelectedMonth(e.target.value);
                  }}
                  className="bg-transparent font-mono text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                />
              </label>
            ) : (
              <label className="inline-flex items-center gap-2 border border-amber-300 bg-amber-50/70 px-3 py-1.5 text-xs text-amber-950">
                <span className="font-medium whitespace-nowrap">
                  {lang === 'bn' ? 'তারিখ নির্বাচন:' : 'Date:'}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                  className="bg-transparent font-mono text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                />
              </label>
            )}
          </div>

          {/* Section Inclusion Checkboxes */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={scope.includeUpstream}
                onChange={(e) =>
                  setScope((s) => ({ ...s, includeUpstream: e.target.checked }))
                }
                className="h-3.5 w-3.5 accent-blue-700"
              />
              {lang === 'bn' ? 'Upstream Provider' : 'Upstream Providers'}
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={scope.includeNttn}
                onChange={(e) =>
                  setScope((s) => ({ ...s, includeNttn: e.target.checked }))
                }
                className="h-3.5 w-3.5 accent-blue-700"
              />
              {lang === 'bn' ? 'NTTN ও গ্রাহক/POP' : 'NTTN & Customer/POP'}
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={scope.includePeriodChanges}
                onChange={(e) =>
                  setScope((s) => ({ ...s, includePeriodChanges: e.target.checked }))
                }
                className="h-3.5 w-3.5 accent-blue-700"
              />
              {lang === 'bn' ? 'Up/Down পরিবর্তন' : 'Up/Down Changes'}
            </label>
          </div>
        </div>

        {/* Channel Switcher: Print Preview | WhatsApp | Email */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setChannelTab('print')}
            className={`inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              channelTab === 'print'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            {lang === 'bn' ? 'প্রিন্ট ও পূর্ণ রিপোর্ট প্রিভিউ' : 'Print & Full Report Preview'}
          </button>

          <button
            type="button"
            onClick={() => setChannelTab('whatsapp')}
            className={`inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              channelTab === 'whatsapp'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {lang === 'bn' ? 'WhatsApp-এ পাঠান' : 'Send via WhatsApp'}
          </button>

          <button
            type="button"
            onClick={() => setChannelTab('email')}
            className={`inline-flex items-center gap-1.5 border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              channelTab === 'email'
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-900'
            }`}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {lang === 'bn' ? 'Email / Gmail-এ পাঠান' : 'Send via Email / Gmail'}
          </button>
        </div>
      </section>

      {/* 2A. WhatsApp Dispatch Composer (No-Print) */}
      {channelTab === 'whatsapp' && (
        <section className="border border-slate-200 bg-white p-5 space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {lang === 'bn'
                  ? `WhatsApp রিপোর্ট — ${periodHeading}`
                  : `WhatsApp Report — ${periodHeading}`}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {lang === 'bn'
                  ? 'নম্বর দিলে সরাসরি ঐ নম্বরে, আর খালি রাখলে WhatsApp-এর যেকোনো গ্রুপ বা কন্টাক্টে পাঠাতে পারবেন'
                  : 'Enter a phone number to message directly, or leave blank to pick any WhatsApp group/contact'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setScope((s) => ({ ...s, compactWhatsApp: false }))}
                className={`px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  !scope.compactWhatsApp
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'পূর্ণাঙ্গ (সব ১৭ লিংক)' : 'Full (All NTTN Links)'}
              </button>
              <button
                type="button"
                onClick={() => setScope((s) => ({ ...s, compactWhatsApp: true }))}
                className={`px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  scope.compactWhatsApp
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {lang === 'bn' ? 'সংক্ষিপ্ত সারসংক্ষেপ' : 'Compact Summary'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'bn'
                    ? 'WhatsApp নম্বর (ঐচ্ছিক, যেমন: 88017XXXXXXXX)'
                    : 'WhatsApp Number (Optional, e.g. 88017XXXXXXXX)'}
                </label>
                <input
                  type="tel"
                  value={contacts.whatsappPhone}
                  onChange={(e) =>
                    setContacts((c) => ({ ...c, whatsappPhone: e.target.value }))
                  }
                  placeholder="88017XXXXXXXX"
                  className="w-full border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {lang === 'bn' ? 'WhatsApp-এ ওপেন করে পাঠান' : 'Open & Send in WhatsApp'}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopy('wa', waText)}
                  className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copiedKey === 'wa' ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      {lang === 'bn' ? 'মেসেজ কপি হয়েছে!' : 'Message Copied!'}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      {lang === 'bn' ? 'WhatsApp মেসেজ কপি করুন' : 'Copy WhatsApp Message'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => exportPeriodReportXlsx(dispatchReport, lang)}
                  className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  {lang === 'bn'
                    ? 'Excel ফাইল ডাউনলোড (সাথে অ্যাটাচ করতে)'
                    : 'Download Excel to Attach'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {lang === 'bn'
                    ? 'মেসেজ প্রিভিউ (প্রয়োজনে এডিট করতে পারবেন)'
                    : 'Message Preview (Editable before sending)'}
                </label>
                {customWaText !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomWaText(null)}
                    className="text-[11px] text-blue-700 hover:underline cursor-pointer"
                  >
                    {lang === 'bn' ? 'অটো ফরম্যাটে ফিরুন' : 'Reset to auto'}
                  </button>
                )}
              </div>
              <textarea
                rows={15}
                value={waText}
                onChange={(e) => setCustomWaText(e.target.value)}
                className="w-full border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </section>
      )}

      {/* 2B. Email / Gmail Dispatch Composer (No-Print) */}
      {channelTab === 'email' && (
        <section className="border border-slate-200 bg-white p-5 space-y-4 no-print">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {lang === 'bn'
                ? `Email / Gmail রিপোর্ট — ${periodHeading}`
                : `Email / Gmail Report — ${periodHeading}`}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {lang === 'bn'
                ? 'প্রাপকের ইমেইল দিয়ে সরাসরি Gmail বা আপনার Email অ্যাপে রিপোর্ট খুলুন; চাইলে নিচের Excel ডাউনলোড করে অ্যাটাচ করুন'
                : 'Enter recipient email to open directly in Gmail or your Mail app; download the Excel file if you want to attach it'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  To ({lang === 'bn' ? 'প্রাপকের ইমেইল' : 'Recipient Email'})
                </label>
                <input
                  type="email"
                  value={contacts.emailTo}
                  onChange={(e) => setContacts((c) => ({ ...c, emailTo: e.target.value }))}
                  placeholder="management@speednet.com"
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CC ({lang === 'bn' ? 'ঐচ্ছিক, কমা দিয়ে একাধিক' : 'Optional, comma-separated'})
                </label>
                <input
                  type="text"
                  value={contacts.emailCc}
                  onChange={(e) => setContacts((c) => ({ ...c, emailCc: e.target.value }))}
                  placeholder="noc@speednet.com"
                  className="w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <a
                  href={gmailHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-blue-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-blue-800 transition-colors"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {lang === 'bn' ? 'Gmail-এ কম্পোজ করুন' : 'Compose in Gmail'}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>

                <a
                  href={mailtoHref}
                  className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <Mail className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  {lang === 'bn' ? 'ডিফল্ট Email অ্যাপে খুলুন' : 'Open in Default Mail App'}
                </a>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy('email', `Subject: ${emailSubject}\n\n${emailBody}`)
                  }
                  className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copiedKey === 'email' ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      {lang === 'bn' ? 'ইমেইল টেক্সট কপি হয়েছে!' : 'Email Text Copied!'}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      {lang === 'bn' ? 'ইমেইল টেক্সট কপি করুন' : 'Copy Email Subject & Body'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => exportPeriodReportXlsx(dispatchReport, lang)}
                  className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  {lang === 'bn'
                    ? 'Excel অ্যাটাচমেন্ট ডাউনলোড'
                    : 'Download Excel Attachment'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setCustomEmailSubject(e.target.value)}
                  className="w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {lang === 'bn' ? 'ইমেইল বডি (এডিটযোগ্য)' : 'Email Body (Editable)'}
                  </label>
                  {(customEmailBody !== null || customEmailSubject !== null) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomEmailSubject(null);
                        setCustomEmailBody(null);
                      }}
                      className="text-[11px] text-blue-700 hover:underline cursor-pointer"
                    >
                      {lang === 'bn' ? 'অটো ফরম্যাটে ফিরুন' : 'Reset to auto'}
                    </button>
                  )}
                </div>
                <textarea
                  rows={13}
                  value={emailBody}
                  onChange={(e) => setCustomEmailBody(e.target.value)}
                  className="w-full border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. OFFICIAL PRINTABLE REPORT SHEET (Always printed; visible on screen in Print Preview tab) */}
      <div className={channelTab === 'print' ? 'space-y-6' : 'hidden print-only space-y-6'}>
        {/* Official Report Masthead */}
        <section className="border border-slate-200 bg-white p-6 print-break-avoid">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-semibold text-blue-800">
                SpeedNet Capacity Register
              </div>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">
                {frequency === 'monthly'
                  ? lang === 'bn'
                    ? `মাসিক ব্যান্ডউইথ ও NTTN ক্যাপাসিটি রিপোর্ট — ${periodHeading}`
                    : `Monthly Bandwidth & NTTN Capacity Report — ${periodHeading}`
                  : lang === 'bn'
                  ? `দৈনিক ব্যান্ডউইথ ও NTTN ক্যাপাসিটি রিপোর্ট — ${periodHeading}`
                  : `Daily Bandwidth & NTTN Capacity Report — ${periodHeading}`}
              </h2>
              <p className="mt-1 text-xs text-slate-600">{t.rules.separationNotice}</p>
            </div>
            <div className="text-right font-mono text-xs text-slate-600 space-y-0.5 tabular-nums">
              <div>
                {lang === 'bn' ? 'সময়কাল:' : 'Period:'}{' '}
                <strong className="text-slate-900">
                  {formatDateDMY(dispatchReport.periodStart)} —{' '}
                  {formatDateDMY(dispatchReport.periodEnd)}
                </strong>
              </div>
              <div>
                {lang === 'bn' ? 'মোট Up/Down এন্ট্রি:' : 'Up/Down Changes:'}{' '}
                <strong className="text-slate-900">
                  {dispatchReport.periodChanges.length}
                </strong>
              </div>
            </div>
          </div>

          {/* 3-Column Separate KPI Summary */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs font-semibold text-blue-900">
                {t.kpi.upstreamTotal}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatMbps(dispatchReport.summary.upstreamTotalMbps)}{' '}
                <span className="text-xs font-normal text-slate-500">Mbps</span>
              </div>
              <div className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                {formatGbps(dispatchReport.summary.upstreamTotalMbps)} ·{' '}
                {dispatchReport.summary.upstreamLinkCount} {t.kpi.linksUnit} ·{' '}
                {lang === 'bn' ? 'পরিবর্তন:' : 'Changes:'}{' '}
                {dispatchReport.upstreamChanges.length}
              </div>
            </div>

            <div className="border border-slate-200 bg-emerald-50/40 p-4">
              <div className="text-xs font-semibold text-emerald-900">
                {t.kpi.nttnTotal}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
                {formatMbps(dispatchReport.summary.nttnTotalMbps)}{' '}
                <span className="text-xs font-normal text-emerald-800">Mbps</span>
              </div>
              <div className="mt-1 font-mono text-xs text-emerald-900 tabular-nums">
                {formatGbps(dispatchReport.summary.nttnTotalMbps)} ·{' '}
                {toDisplaySerial(dispatchReport.nttnLinks.length, lang)}
                {t.nttn.linksSuffix} · {lang === 'bn' ? 'পরিবর্তন:' : 'Changes:'}{' '}
                {dispatchReport.nttnChanges.length}
              </div>
            </div>

            <div className="border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs font-semibold text-slate-700">
                {lang === 'bn'
                  ? 'খোলা Temporary ও অডিট অবস্থা'
                  : 'Open Temporary & Audit Status'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {dispatchReport.summary.openTempTotalCount}{' '}
                <span className="text-xs font-normal text-slate-500">
                  {lang === 'bn' ? 'টি খোলা' : 'Open'}
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                {t.kpi.overdueLabel}:{' '}
                <strong
                  className={
                    dispatchReport.summary.overdueTempTotalCount > 0
                      ? 'text-red-700'
                      : 'text-slate-900'
                  }
                >
                  {dispatchReport.summary.overdueTempTotalCount}
                </strong>{' '}
                · {t.kpi.completedErrors}: {dispatchReport.summary.completedErrorsCount}
              </div>
            </div>
          </div>
        </section>

        {/* Section A: Upstream Bandwidth by Provider */}
        {scope.includeUpstream && (
          <section className="border border-slate-200 bg-white print-break-avoid">
            <div className="flex items-baseline justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-900">
                {lang === 'bn'
                  ? '১. Provider অনুযায়ী বর্তমান Upstream ব্যান্ডউইথ ক্যাপাসিটি'
                  : '1. Current Upstream Bandwidth by Provider'}
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Mbps · {formatDateDMY(dispatchReport.periodEnd)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-2.5 pl-5 pr-2 whitespace-nowrap">Provider</th>
                    {UPSTREAM_SERVICES.map((svc) => (
                      <th
                        key={svc}
                        className="px-2 py-2.5 text-right font-mono whitespace-nowrap"
                      >
                        {svc}
                      </th>
                    ))}
                    <th className="px-2.5 py-2.5 text-right font-mono border-l border-slate-200 whitespace-nowrap">
                      {lang === 'bn' ? 'মোট Mbps' : 'Total Mbps'}
                    </th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">
                      {t.summary.colLinks}
                    </th>
                    <th className="py-2.5 pl-2.5 pr-5 whitespace-nowrap">
                      {lang === 'bn' ? 'এই সময়ের Up/Down' : 'Period Up/Down'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upstreamProviderRows.map((row) => {
                    const chgs = dispatchReport.changesByProviderId[row.provider.id] || [];
                    return (
                      <tr key={row.provider.id} className="h-10">
                        <td className="py-2 pl-5 pr-2 font-semibold text-slate-900 whitespace-nowrap">
                          {row.provider.name}
                        </td>
                        {UPSTREAM_SERVICES.map((svc) => (
                          <td
                            key={svc}
                            className={`px-2 py-2 text-right font-mono tabular-nums whitespace-nowrap ${
                              row.byService[svc] > 0
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-300'
                            }`}
                          >
                            {row.byService[svc] > 0 ? formatMbps(row.byService[svc]) : '—'}
                          </td>
                        ))}
                        <td className="px-2.5 py-2 text-right font-mono font-bold text-blue-900 tabular-nums border-l border-slate-200 whitespace-nowrap">
                          {formatMbps(row.totalMbps)}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-slate-700 tabular-nums">
                          {row.linkCount}
                        </td>
                        <td className="py-2 pl-2.5 pr-5 text-slate-700">
                          {chgs.length > 0 ? (
                            <span className="font-medium text-blue-800">
                              {formatLinkChangeSummary(chgs, lang)}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              {lang === 'bn' ? 'অপরিবর্তিত' : 'No change'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                    <td className="py-2.5 pl-5 pr-2">
                      {lang === 'bn' ? 'Upstream মোট' : 'Upstream Total'}
                    </td>
                    {UPSTREAM_SERVICES.map((svc) => {
                      const sRow = dispatchReport.summary.serviceRows.find(
                        (s) => s.service === svc
                      );
                      const val = sRow?.currentMbps || 0;
                      return (
                        <td
                          key={svc}
                          className="px-2 py-2.5 text-right font-mono tabular-nums text-blue-950"
                        >
                          {val > 0 ? formatMbps(val) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums border-l border-slate-200 text-blue-950 whitespace-nowrap">
                      {formatMbps(dispatchReport.summary.upstreamTotalMbps)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-blue-950">
                      {dispatchReport.summary.upstreamLinkCount}
                    </td>
                    <td className="py-2.5 pl-2.5 pr-5 font-mono text-slate-600 whitespace-nowrap">
                      {formatGbps(dispatchReport.summary.upstreamTotalMbps)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* Section B: NTTN Provider & Customer / POP Report with Period Up/Down Column */}
        {scope.includeNttn && (
          <section className="border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {lang === 'bn'
                    ? '২. NTTN Provider ও গ্রাহক / POP অনুযায়ী ক্যাপাসিটি এবং Up/Down অবস্থা'
                    : '2. NTTN Capacity by Provider & Customer / POP with Up/Down Status'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {nttnProviderRows
                    .map(
                      (r) =>
                        `${r.provider.name.replace(' (NTTN)', '')}: ${formatMbps(
                          r.totalMbps
                        )} Mbps (${r.linkCount})`
                    )
                    .join(' · ')}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-900 tabular-nums">
                {formatMbps(dispatchReport.summary.nttnTotalMbps)} Mbps ·{' '}
                {toDisplaySerial(dispatchReport.nttnLinks.length, lang)}
                {t.nttn.linksSuffix}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <th className="py-2.5 pl-4 pr-2 text-center w-10">{t.nttn.colSerial}</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colLinkKey}</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colProvider}</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colLinkId}</th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">
                      {lang === 'bn' ? 'গ্রাহক / এলাকা / POP (রুট)' : 'Customer / Area / POP'}
                    </th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">{t.nttn.colStartDate}</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">
                      {t.nttn.colCapacity}
                    </th>
                    <th className="px-2.5 py-2.5 whitespace-nowrap">
                      {lang === 'bn'
                        ? `Up/Down অবস্থা (${periodHeading})`
                        : `Up/Down Status (${periodHeading})`}
                    </th>
                    <th className="py-2.5 pl-2.5 pr-4 whitespace-nowrap">
                      {t.nttn.colStatusNote}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dispatchReport.nttnLinks.map((item, idx) => {
                    const hasChanges = item.periodChanges.length > 0;
                    return (
                      <tr
                        key={item.link.id}
                        className={hasChanges ? 'bg-blue-50/35' : ''}
                      >
                        <td className="py-2 pl-4 pr-2 text-center font-mono text-slate-500 tabular-nums">
                          {toDisplaySerial(idx + 1, lang)}
                        </td>
                        <td className="px-2.5 py-2 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {item.link.circuitId}
                        </td>
                        <td className="px-2.5 py-2 text-slate-700 whitespace-nowrap">
                          {item.provider?.name.replace(' (NTTN)', '') || '—'}
                        </td>
                        <td className="px-2.5 py-2 font-mono text-slate-600 whitespace-nowrap">
                          {item.link.providerLinkId || '—'}
                        </td>
                        <td className="px-2.5 py-2 text-slate-900">
                          {item.link.customerName ? (
                            <div>
                              <span className="font-semibold">{item.link.customerName}</span>
                              <span className="text-slate-500"> · {item.link.popLocation}</span>
                            </div>
                          ) : (
                            <span className="font-medium">{item.link.popLocation}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateDMY(item.link.startDate)}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatMbps(item.currentMbps)}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          {hasChanges ? (
                            <span
                              className={`font-semibold ${
                                item.periodNetDelta >= 0
                                  ? 'text-emerald-800'
                                  : 'text-red-700'
                              }`}
                            >
                              {formatLinkChangeSummary(item.periodChanges, lang)}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              {lang === 'bn' ? 'কোনো পরিবর্তন নেই' : 'No change'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pl-2.5 pr-4 text-slate-700">
                          {item.link.statusNote || 'Active'}
                          {item.hasOpenTemp && (
                            <span className="ml-1.5 font-mono text-[11px] font-semibold text-amber-800">
                              (Temp +{formatMbps(item.openTempMbps)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-emerald-50/50 font-bold text-emerald-950">
                    <td className="py-2.5 pl-4 pr-2 text-center">{t.nttn.totalLabel}</td>
                    <td className="px-2.5 py-2.5" colSpan={5}>
                      {lang === 'bn'
                        ? 'সকল সক্রিয় NTTN লিংকের মোট ক্যাপাসিটি'
                        : 'Total Active NTTN Transmission Capacity'}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatMbps(dispatchReport.summary.nttnTotalMbps)} Mbps
                    </td>
                    <td className="px-2.5 py-2.5 font-medium whitespace-nowrap">
                      {dispatchReport.nttnChanges.length > 0
                        ? `${dispatchReport.nttnChanges.length} ${
                            lang === 'bn' ? 'টি পরিবর্তন' : 'changes'
                          }`
                        : lang === 'bn'
                        ? 'অপরিবর্তিত'
                        : 'No changes'}
                    </td>
                    <td className="py-2.5 pl-2.5 pr-4 whitespace-nowrap">
                      {toDisplaySerial(dispatchReport.nttnLinks.length, lang)}
                      {t.nttn.linksSuffix}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* Section C: Period Upgradation & Downgradation Activity */}
        {scope.includePeriodChanges && (
          <section className="border border-slate-200 bg-white print-break-avoid">
            <div className="flex items-baseline justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-900">
                {lang === 'bn'
                  ? `৩. এই সময়ের Upgradation ও Downgradation বিবরণ (${periodHeading})`
                  : `3. Upgradation & Downgradation Activity (${periodHeading})`}
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                Completed: {dispatchReport.periodChanges.length}
              </span>
            </div>

            {dispatchReport.periodChanges.length === 0 ? (
              <div className="px-5 py-6 text-xs text-slate-500">
                {lang === 'bn'
                  ? `${periodHeading}-এ কোনো Completed Upgrade বা Downgrade পরিবর্তন রেকর্ড হয়নি।`
                  : `No Completed Upgrade or Downgrade changes were recorded during ${periodHeading}.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                      <th className="py-2.5 pl-5 pr-2 whitespace-nowrap">{t.changes.colDate}</th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">{t.changes.colCode}</th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">Provider</th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">Link Key / Service</th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">
                        {lang === 'bn' ? 'গ্রাহক / POP' : 'Customer / POP'}
                      </th>
                      <th className="px-2.5 py-2.5 whitespace-nowrap">{t.changes.colType}</th>
                      <th className="px-2.5 py-2.5 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'পূর্বের → নতুন' : 'Before → After'}
                      </th>
                      <th className="px-2.5 py-2.5 text-right whitespace-nowrap">
                        {t.changes.colDelta}
                      </th>
                      <th className="py-2.5 pl-2.5 pr-5 whitespace-nowrap">{t.changes.colRef}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dispatchReport.periodChanges.map((c) => {
                      const isPos = c.signedDelta >= 0;
                      return (
                        <tr key={c.change.id} className="h-10">
                          <td className="py-2 pl-5 pr-2 font-mono font-medium text-slate-800 tabular-nums whitespace-nowrap">
                            {formatDateDMY(c.change.effectiveDate)}
                          </td>
                          <td className="px-2.5 py-2 font-mono text-slate-600 whitespace-nowrap">
                            {c.change.changeCode}
                          </td>
                          <td className="px-2.5 py-2 text-slate-700 whitespace-nowrap">
                            {c.provider?.name.replace(' (NTTN)', '') || '—'}
                          </td>
                          <td className="px-2.5 py-2 font-mono whitespace-nowrap">
                            <span className="font-semibold text-slate-900">
                              {c.link?.circuitId}
                            </span>{' '}
                            <span className="text-slate-500">({c.link?.service})</span>
                          </td>
                          <td className="px-2.5 py-2 text-slate-800">
                            {c.link?.customerName
                              ? `${c.link.customerName} · ${c.link.popLocation}`
                              : c.link?.popLocation || c.link?.name}
                          </td>
                          <td className="px-2.5 py-2 font-medium text-slate-800 whitespace-nowrap">
                            {c.change.changeType}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700">
                            {formatMbps(c.beforeMbps)} →{' '}
                            <strong className="text-slate-900">{formatMbps(c.afterMbps)}</strong>
                          </td>
                          <td
                            className={`px-2.5 py-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                              isPos ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isPos ? '+' : '−'}
                            {formatMbps(Math.abs(c.signedDelta))}
                          </td>
                          <td className="py-2 pl-2.5 pr-5 text-slate-600">
                            {[c.change.referenceNo, c.change.remarks].filter(Boolean).join(' · ') ||
                              '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Print-Only Signature Block */}
        <div className="hidden print-only pt-8">
          <div className="grid grid-cols-3 gap-12 text-xs text-slate-700">
            <div className="border-t border-slate-400 pt-2">
              {lang === 'bn' ? 'প্রস্তুতকারী (NOC / Operations)' : 'Prepared By (NOC / Operations)'}
            </div>
            <div className="border-t border-slate-400 pt-2">
              {lang === 'bn' ? 'যাচাইকারী (Network Lead)' : 'Verified By (Network Lead)'}
            </div>
            <div className="border-t border-slate-400 pt-2">
              {lang === 'bn' ? 'অনুমোদনকারী (Management)' : 'Approved By (Management)'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Annual Monthly Upgradation & Downgradation Ledger (No-Print unless needed; compact reference) */}
      <section className="border border-slate-200 bg-white no-print">
        <div className="flex items-baseline justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {t.reports.monthlyTableTitle} — {dispatchReport.summary.reportYear}
          </h3>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            Completed Entries Only (Mbps)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">{t.reports.colMonth}</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-l border-slate-200">
                  {t.reports.colUpUpgrade}
                </th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">
                  {t.reports.colUpDowngrade}
                </th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">{t.reports.colUpNet}</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-l border-slate-200 bg-emerald-50/40 text-emerald-950">
                  {t.reports.colNttnUpgrade}
                </th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap bg-emerald-50/40 text-emerald-950">
                  {t.reports.colNttnDowngrade}
                </th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap bg-emerald-50/40 text-emerald-950">
                  {t.reports.colNttnNet}
                </th>
                <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap border-l border-slate-200">
                  {t.reports.colTotalEntries}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispatchReport.summary.monthlyMovements.map((m) => {
                const upUp = m.upstreamUpgrade + m.upstreamTempUp;
                const upDown = m.upstreamDowngrade + m.upstreamTempReturn;
                const nttnUp = m.nttnUpgrade + m.nttnTempUp;
                const nttnDown = m.nttnDowngrade + m.nttnTempReturn;
                const isSelectedMonth = frequency === 'monthly' && m.monthKey === selectedMonth;
                return (
                  <tr
                    key={m.monthKey}
                    onClick={() => {
                      setFrequency('monthly');
                      setSelectedMonth(m.monthKey);
                    }}
                    className={`h-10 cursor-pointer transition-colors ${
                      isSelectedMonth ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-2 pl-5 pr-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {months[m.monthIndex]} {dispatchReport.summary.reportYear}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums border-l border-slate-100 text-emerald-700">
                      {upUp > 0 ? `+${formatMbps(upUp)}` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-red-700">
                      {upDown > 0 ? (
                        `−${formatMbps(upDown)}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums ${
                        m.upstreamNet > 0
                          ? 'text-emerald-800'
                          : m.upstreamNet < 0
                          ? 'text-red-800'
                          : 'text-slate-300'
                      }`}
                    >
                      {m.upstreamNet !== 0
                        ? `${m.upstreamNet > 0 ? '+' : '−'}${formatMbps(Math.abs(m.upstreamNet))}`
                        : '—'}
                    </td>

                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums border-l border-slate-200 bg-emerald-50/15 text-emerald-700">
                      {nttnUp > 0 ? (
                        `+${formatMbps(nttnUp)}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums bg-emerald-50/15 text-red-700">
                      {nttnDown > 0 ? (
                        `−${formatMbps(nttnDown)}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums bg-emerald-50/15 ${
                        m.nttnNet > 0
                          ? 'text-emerald-800'
                          : m.nttnNet < 0
                          ? 'text-red-800'
                          : 'text-slate-300'
                      }`}
                    >
                      {m.nttnNet !== 0
                        ? `${m.nttnNet > 0 ? '+' : '−'}${formatMbps(Math.abs(m.nttnNet))}`
                        : '—'}
                    </td>

                    <td className="py-2 pl-3 pr-5 text-right font-mono text-xs text-slate-600 tabular-nums border-l border-slate-100">
                      {m.completedCount > 0 ? m.completedCount : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900">
                <td className="py-2.5 pl-5 pr-3">
                  {lang === 'bn' ? 'বার্ষিক মোট' : 'Annual Total'} (
                  {dispatchReport.summary.reportYear})
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums border-l border-slate-200 text-emerald-800">
                  +{formatMbps(annualTotals.upUp)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-red-800">
                  −{formatMbps(annualTotals.upDown)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
                  {annualTotals.upNet >= 0 ? '+' : '−'}
                  {formatMbps(Math.abs(annualTotals.upNet))}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums border-l border-slate-200 bg-emerald-50/40 text-emerald-900">
                  +{formatMbps(annualTotals.nttnUp)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums bg-emerald-50/40 text-red-800">
                  −{formatMbps(annualTotals.nttnDown)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums bg-emerald-50/40 text-emerald-950">
                  {annualTotals.nttnNet >= 0 ? '+' : '−'}
                  {formatMbps(Math.abs(annualTotals.nttnNet))}
                </td>
                <td className="py-2.5 pl-3 pr-5 text-right font-mono tabular-nums border-l border-slate-200">
                  {annualTotals.count}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 5. Full Register Export & JSON Backup Utilities (No-Print) */}
      <section className="border border-slate-200 bg-white p-5 space-y-3 no-print">
        <div className="text-xs font-semibold text-slate-700">
          {lang === 'bn'
            ? 'সম্পূর্ণ রেজিস্টার এক্সপোর্ট ও ডেটা ব্যাকআপ'
            : 'Full Register Exports & Data Backup'}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportWorkbookXlsx(data, summary)}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            {t.reports.exportExcel} (4 Sheets)
          </button>

          <button
            type="button"
            onClick={() => exportSummaryCsv(summary)}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            {t.reports.exportCsv}
          </button>

          <button
            type="button"
            onClick={() => exportBackupJson(data, summary.asOfDate)}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t.reports.backupJson}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t.reports.restoreJson}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          {confirmReset ? (
            <button
              type="button"
              onClick={() => {
                onResetToSeed();
                setConfirmReset(false);
              }}
              onBlur={() => setConfirmReset(false)}
              className="inline-flex items-center gap-1.5 bg-red-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === 'bn' ? 'রিসেট নিশ্চিত করুন?' : 'Confirm Reset?'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t.reports.resetSeed}
            </button>
          )}
        </div>
        {importError && <p className="text-xs font-medium text-red-700">{importError}</p>}
      </section>
    </div>
  );
};
