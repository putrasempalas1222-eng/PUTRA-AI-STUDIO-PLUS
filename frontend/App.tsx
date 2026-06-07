import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ChatSession, Attachment, UserStatusRole, AccountDevice, UserProfile } from './types';
import { geminiService } from './services/AiServices';
import { auth, ensureUserDocument, getUserChatHistory, getUserDevices, logoutUserDevice, registerUserDevice, saveChatSession, updateUserDeviceHeartbeat, updateUserDisplayName } from './services/firebase';
import { EmailAuthProvider, GoogleAuthProvider, onAuthStateChanged, reauthenticateWithCredential, reauthenticateWithPopup, signOut, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar, AppView } from './components/Sidebar';
import { SoreaVoice } from './components/SoreaVoice';
import { PutraPpt } from './components/PutraPpt';
import { PutraPackages } from './components/PutraPackages';
import { PutraConvert } from './components/PutraConvert';
import { AuthModal, AuthMode } from './components/AuthModal';
import { AlertTriangle, CalendarClock, Edit3, Lock, LogOut, Menu, MonitorSmartphone, Moon, RefreshCw, Save, ShieldCheck, Sparkles, Sun, Trash2, User as UserIcon, X } from 'lucide-react';

const THINKING_STEPS = [
  'Memahami permintaan',
  'Menentukan tujuan',
  'Menyusun jawaban',
];

const FALLBACK_THINKING_LINES = [
  'Connecting to PUTRA AI STUDIO...',
  'Understanding the request...',
  'Checking conversation context...',
  'Preparing the best answer...',
];

const INDONESIAN_THINKING_LINES = [
  'Menghubungkan ke PUTRA AI STUDIO...',
  'Membaca maksud pertanyaan...',
  'Menimbang konteks percakapan...',
  'Menyusun jawaban terbaik...',
];

const IMAGE_GENERATION_STEPS = [
  'Membaca prompt gambar',
  'Menyusun komposisi visual',
  'Merender gambar',
];

const IMAGE_ANALYSIS_STEPS = [
  'Memeriksa gambar',
  'Mengenali detail visual',
  'Menyusun analisis gambar',
];

const FILE_ANALYSIS_STEPS = [
  'Membaca file',
  'Mengambil poin penting',
  'Menyusun analisis file',
];
function isLikelyIndonesian(text: string) {
  const normalized = ` ${text.toLowerCase()} `;
  return /\b(apa|apakah|siapa|bagaimana|kenapa|mengapa|jelaskan|tolong|buatkan|perbaiki|gambar|file|saya|kamu|yang|dan|atau|dengan|untuk|dari|ini|itu)\b/.test(normalized);
}

function getFallbackThinkingLines(prompt: string) {
  return isLikelyIndonesian(prompt) ? INDONESIAN_THINKING_LINES : FALLBACK_THINKING_LINES;
}

const APP_ICON_URL = 'https://firebasestorage.googleapis.com/v0/b/play-integrity-2adpr7x4a8xhyex.firebasestorage.app/o/Desain_tanpa_judul-removebg-preview.png?alt=media&token=d5be2a46-6352-48a2-89ae-e89574279f09';

const DEVICE_ID_STORAGE_KEY = 'putra-ai-plus-device-id';
const ACTIVE_VIEW_STORAGE_KEY = 'putra-ai-plus-active-view';
const RESTORABLE_VIEWS: AppView[] = ['chat', 'voice', 'ppt', 'packages', 'account', 'convert-word-pdf', 'convert-ppt-pdf'];

const getStoredActiveView = (): AppView => {
  if (typeof window === 'undefined') return 'chat';
  const storedView = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) as AppView | null;
  return storedView && RESTORABLE_VIEWS.includes(storedView) ? storedView : 'chat';
};

const getClientDeviceId = () => {
  if (typeof window === 'undefined') return 'server-device';
  const existingId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existingId) return existingId;

  const nextId = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
  return nextId;
};

const getClientDeviceName = () => {
  if (typeof navigator === 'undefined') return 'Perangkat ini';
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';

  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return platform || 'Perangkat ini';
};

const getClientUserAgent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

const formatDeviceDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Tidak diketahui';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatRoleExpiryDate = (value?: string | null) => {
  if (!value) return 'Tidak ada masa berlaku';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Tanggal tidak valid';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const isRoleExpired = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() <= Date.now();
};

const IMAGE_GENERATION_KEYWORDS = [
  'buat gambar',
  'buatkan gambar',
  'generate gambar',
  'hasilkan gambar',
  'bikin gambar',
  'buat ilustrasi',
  'buatkan ilustrasi',
  'generate ilustrasi',
  'buat poster',
  'buatkan poster',
  'generate poster',
  'buat logo',
  'buatkan logo',
  'generate logo',
  'buat desain',
  'buatkan desain',
  'render gambar',
  'draw image',
  'generate image',
  'create image',
];

const IMAGE_GENERATION_PATTERN = /\b(buat|buatkan|bikin|generate|hasilkan|render|draw|create)\b[\s\S]{0,80}\b(gambar|image|ilustrasi|poster|logo|desain|visual)\b/i;

const DOCX_REQUEST_PATTERN = /\b(docx|word|ms word|microsoft word|file makalah|dokumen makalah|buatkan makalah|makalah|download file|file doc)\b/i;

const wantsDocxFile = (text: string) => DOCX_REQUEST_PATTERN.test(text);

const getDocxTitle = (text: string) => {
  const cleanText = text
    .replace(/\b(buatkan|buat|jadikan|generate|file|docx|word|makalah|dokumen|download|tentang|judul)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanText ? `Makalah ${cleanText}` : 'Dokumen PUTRA AI';
};

const getThinkingSteps = (text: string, attachments: Attachment[]) => {
  if (attachments.some((attachment) => attachment.mimeType.startsWith('image/'))) {
    return IMAGE_ANALYSIS_STEPS;
  }

  if (attachments.length > 0) {
    return FILE_ANALYSIS_STEPS;
  }

  const normalizedText = text.toLowerCase();
  if (
    IMAGE_GENERATION_PATTERN.test(text) ||
    IMAGE_GENERATION_KEYWORDS.some((keyword) => normalizedText.includes(keyword))
  ) {
    return IMAGE_GENERATION_STEPS;
  }

  return THINKING_STEPS;
};

const isImageGenerationStepSet = (steps: string[]) => steps === IMAGE_GENERATION_STEPS;


type DisplayError = {
  title: string;
  code: string;
  detail: string;
};

function formatDisplayError(error: string): DisplayError {
  const rawError = String(error || '').trim();
  const codeMatch = rawError.match(/^([A-Z0-9_ -]{3,40})\s*:\s*([\s\S]*)$/);
  const code = codeMatch ? codeMatch[1].trim().replace(/\s+/g, '_') : 'APP_ERROR';
  const body = codeMatch ? codeMatch[2].trim() : rawError;
  const detailMatch = body.match(/^([\s\S]*?)\s*Detail\s*:\s*([\s\S]*)$/i);
  const message = (detailMatch ? detailMatch[1] : body).trim();
  const detail = (detailMatch ? detailMatch[2] : body).trim();
  const normalized = `${code} ${rawError}`.toLowerCase();

  if (
    normalized.includes('fetch') ||
    normalized.includes('server sedang ada perbaikan') ||
    normalized.includes('network') ||
    normalized.includes('econnrefused') ||
    normalized.includes('model_not_ready')
  ) {
    return {
      title: 'Server sedang ada perbaikan',
      code: code === 'APP_ERROR' ? 'SERVER_MAINTENANCE' : code,
      detail: detail || message || 'Koneksi ke server AI belum stabil.',
    };
  }

  return {
    title: message || 'Terjadi kesalahan',
    code,
    detail: detail || rawError || 'Silakan coba lagi.',
  };
}

const ErrorNotice: React.FC<{ error: string; compact?: boolean; isDark?: boolean }> = ({ error, compact = false, isDark = false }) => {
  const displayError = formatDisplayError(error);

  return (
    <div className={`mx-auto ${compact ? 'mt-4 max-w-xl' : 'mb-8 max-w-3xl'} rounded-2xl border p-4 text-left shadow-sm ${
      isDark
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-50'
        : 'border-amber-200 bg-amber-50 text-amber-950'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${isDark ? 'bg-amber-300/15 text-amber-200' : 'bg-amber-100 text-amber-700'}`}>
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{displayError.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
              isDark ? 'bg-slate-950/40 text-amber-100' : 'bg-white text-amber-800 ring-1 ring-amber-200'
            }`}>
              {displayError.code}
            </span>
          </div>
          <p className={`mt-1 break-words text-xs leading-relaxed ${isDark ? 'text-amber-100/80' : 'text-amber-900/75'}`}>
            {displayError.detail}
          </p>
        </div>
      </div>
    </div>
  );
};


const AccountDeviceModal: React.FC<{
  user: FirebaseUser;
  userRole: UserStatusRole;
  devices: AccountDevice[];
  currentDeviceId: string;
  isDark: boolean;
  isBlocked: boolean;
  error: string;
  isRefreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onLogoutDevice: (device: AccountDevice) => void;
}> = ({ user, userRole, devices, currentDeviceId, isDark, isBlocked, error, isRefreshing, onClose, onRefresh, onLogoutDevice }) => {
  const activeDevices = devices.filter((device) => device.active);
  const username = user.displayName || user.email?.split('@')[0] || 'Pengguna';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-5 backdrop-blur-sm">
      <section className={`flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border shadow-2xl ${
        isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
      }`}>
        <div className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-500">PUTRA AI PLUS</p>
            <h2 className="text-xl font-semibold">Informasi akun</h2>
          </div>
          {!isBlocked && (
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full p-2 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              aria-label="Tutup informasi akun"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          {isBlocked && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-amber-400/20 bg-amber-400/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              Akun ini sudah aktif di 3 device. Logout salah satu device lama dulu untuk melanjutkan di perangkat ini.
            </div>
          )}

          {error && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-red-400/20 bg-red-400/10 text-red-100' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 sm:col-span-2 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</p>
              <p className="mt-1 truncate text-lg font-semibold">{username}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-1 break-all text-sm">{user.email || 'Belum ada email'}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${isDark ? 'border-blue-400/20 bg-blue-400/10' : 'border-blue-100 bg-blue-50'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Role</p>
              <p className="mt-2 text-2xl font-bold uppercase text-blue-600">{userRole}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Device aktif: {activeDevices.length}/3</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Device aktif</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Device tidak aktif 7 hari otomatis keluar.</p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${isDark ? 'bg-slate-900 text-slate-200 hover:bg-slate-800' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {devices.length === 0 ? (
              <div className={`rounded-2xl border px-4 py-5 text-center text-sm ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                Belum ada device yang tercatat.
              </div>
            ) : devices.map((device) => {
              const isCurrent = device.id === currentDeviceId || device.isCurrent;
              return (
                <div key={device.id} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'
                } ${!device.active ? 'opacity-55' : ''}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`rounded-2xl p-2 ${isDark ? 'bg-slate-800 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                      <MonitorSmartphone size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{device.name}</p>
                        {isCurrent && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">Device ini</span>}
                        {!device.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Keluar</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aktif terakhir: {formatDeviceDate(device.lastActive)}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">{device.userAgent || device.id}</p>
                    </div>
                  </div>

                  {device.active && !isCurrent && (
                    <button
                      type="button"
                      onClick={() => onLogoutDevice(device)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${isDark ? 'bg-red-400/10 text-red-200 hover:bg-red-400/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      <Trash2 size={15} />
                      Logout device
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};


const AccountPage: React.FC<{
  user: FirebaseUser;
  userRole: UserStatusRole;
  roleExpiresAt?: string | null;
  devices: AccountDevice[];
  currentDeviceId: string;
  isDark: boolean;
  isBlocked: boolean;
  error: string;
  usernameDraft: string;
  isSavingUsername: boolean;
  isRefreshing: boolean;
  onUsernameChange: (value: string) => void;
  onSaveUsername: () => void;
  onRefresh: () => void;
  onLogoutDevice: (device: AccountDevice) => void;
}> = ({ user, userRole, roleExpiresAt, devices, currentDeviceId, isDark, isBlocked, error, usernameDraft, isSavingUsername, isRefreshing, onUsernameChange, onSaveUsername, onRefresh, onLogoutDevice }) => {
  const activeDevices = devices.filter((device) => device.active);
  const isPaid = userRole === 'pro' || userRole === 'plus';
  const expiryText = isPaid
    ? roleExpiresAt
      ? formatRoleExpiryDate(roleExpiresAt)
      : 'Belum ada tanggal kadaluarsa'
    : 'Basic aktif selamanya';
  const username = usernameDraft.trim() || user.displayName || user.email?.split('@')[0] || 'Pengguna';
  const planTone = userRole === 'plus'
    ? isDark ? 'from-violet-400 to-fuchsia-300' : 'from-violet-600 to-fuchsia-500'
    : userRole === 'pro'
      ? isDark ? 'from-emerald-300 to-blue-300' : 'from-emerald-500 to-blue-600'
      : isDark ? 'from-blue-300 to-sky-200' : 'from-blue-600 to-sky-500';

  return (
    <main className={`min-h-0 flex-1 overflow-y-auto transition-colors ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#f7f9fc] text-slate-950'}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 lg:px-8">
        <section className={`relative overflow-hidden rounded-[28px] border p-5 shadow-sm md:p-7 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r ${planTone} opacity-15`} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] bg-gradient-to-br ${planTone} text-3xl font-bold text-white shadow-lg shadow-blue-600/20`}>
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${isDark ? 'bg-white/10 text-blue-100 ring-1 ring-white/10' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'}`}>
                    PUTRA AI PLUS
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${isDark ? 'bg-slate-950 text-slate-200 ring-1 ring-slate-700' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
                    {activeDevices.length}/3 device aktif
                  </span>
                </div>
                <h1 className="truncate text-3xl font-semibold tracking-normal md:text-5xl">{username}</h1>
                <p className={`mt-2 max-w-2xl text-sm leading-6 md:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Kelola profil, masa berlaku paket, dan perangkat yang masih tersambung ke akun ini.
                </p>
              </div>
            </div>

            <div className={`rounded-[24px] border p-4 shadow-sm ${isDark ? 'border-slate-700 bg-slate-950/70' : 'border-slate-200 bg-slate-50/90'}`}>
              <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Paket aktif</p>
              <div className="mt-2 flex items-end gap-3">
                <span className={`bg-gradient-to-r ${planTone} bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent`}>
                  {userRole}
                </span>
                <ShieldCheck className={isPaid ? 'mb-1 text-emerald-500' : 'mb-1 text-blue-500'} size={22} />
              </div>
              <p className={`mt-2 max-w-[320px] text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isPaid
                  ? `Aktif sampai ${expiryText}. Setelah kadaluarsa otomatis kembali ke Basic.`
                  : expiryText}
              </p>
            </div>
          </div>
        </section>

        {(isBlocked || error) && (
          <div className={`rounded-3xl border px-4 py-3 text-sm shadow-sm ${isBlocked ? (isDark ? 'border-amber-400/20 bg-amber-400/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900') : (isDark ? 'border-red-400/20 bg-red-400/10 text-red-100' : 'border-red-200 bg-red-50 text-red-700')}`}>
            {isBlocked ? 'Akun ini sudah aktif di 3 device. Logout salah satu device lama dulu untuk melanjutkan di perangkat ini.' : error}
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Profil</p>
                <h2 className="mt-1 text-2xl font-semibold">Data akun</h2>
              </div>
              <div className={`rounded-2xl p-3 ${isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-600'}`}>
                <Edit3 size={22} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div>
                <label className={`mb-2 block text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
                <input
                  value={usernameDraft}
                  onChange={(event) => onUsernameChange(event.target.value.slice(0, 24))}
                  className={`h-14 w-full rounded-2xl border px-4 text-base outline-none transition-all focus:ring-4 ${isDark ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-blue-400 focus:ring-blue-400/10' : 'border-slate-200 bg-white text-slate-950 focus:border-blue-500 focus:ring-blue-500/10'}`}
                  placeholder="Username"
                />
              </div>

              <div>
                <label className={`mb-2 block text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
                <div className={`flex h-14 items-center rounded-2xl border px-4 text-sm ${isDark ? 'border-slate-700 bg-slate-950 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  <span className="truncate">{user.email || 'Belum ada email'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onSaveUsername}
                disabled={isSavingUsername || !usernameDraft.trim()}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingUsername ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}
                Simpan
              </button>
            </div>
          </div>

          <div className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 ${isDark ? 'bg-emerald-400/10 text-emerald-200' : 'bg-emerald-50 text-emerald-600'}`}>
                <CalendarClock size={24} />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Masa berlaku</p>
                <h2 className="mt-1 text-2xl font-semibold">{isPaid ? expiryText : 'Basic selamanya'}</h2>
                <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {isPaid
                    ? 'Tanggal ini dicek otomatis oleh server. Jika masa aktif habis, paket kembali ke Basic.'
                    : 'Upgrade ke Pro atau Plus untuk limit lebih besar dan prioritas fitur.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Keamanan</p>
              <h2 className="mt-1 text-2xl font-semibold">Device terhubung</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Maksimal 3 device aktif. Tidak aktif 7 hari akan logout otomatis.</p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {devices.length === 0 ? (
              <div className={`rounded-3xl border px-4 py-8 text-center text-sm ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                Belum ada device yang tercatat.
              </div>
            ) : devices.map((device) => {
              const isCurrent = device.id === currentDeviceId || device.isCurrent;
              return (
                <div key={device.id} className={`flex flex-col gap-3 rounded-3xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isDark ? 'border-slate-800 bg-slate-950/50 hover:bg-slate-950' : 'border-slate-200 bg-slate-50 hover:bg-white'
                } ${!device.active ? 'opacity-55' : ''}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`rounded-2xl p-3 ${isDark ? 'bg-slate-800 text-blue-300' : 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200'}`}>
                      <MonitorSmartphone size={21} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{device.name}</p>
                        {isCurrent && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">Device ini</span>}
                        {!device.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Keluar</span>}
                      </div>
                      <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aktif terakhir: {formatDeviceDate(device.lastActive)}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">{device.userAgent || device.id}</p>
                    </div>
                  </div>
                  {device.active && !isCurrent && (
                    <button
                      type="button"
                      onClick={() => onLogoutDevice(device)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isDark ? 'bg-red-400/10 text-red-200 hover:bg-red-400/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      <Trash2 size={15} />
                      Logout device
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};

const ReauthDeviceModal: React.FC<{
  deviceName: string;
  password: string;
  isDark: boolean;
  error: string;
  isLoading: boolean;
  onPasswordChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ deviceName, password, isDark, error, isLoading, onPasswordChange, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
    <section className={`w-full max-w-md rounded-3xl border p-5 shadow-2xl ${isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-2 ${isDark ? 'bg-blue-400/10 text-blue-200' : 'bg-blue-50 text-blue-600'}`}>
          <Lock size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Konfirmasi password</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Masukkan password akun untuk logout device: <span className="font-semibold">{deviceName}</span>.</p>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">{error}</p>}
      <input
        type="password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onConfirm();
        }}
        className={`mt-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100 focus:border-blue-400' : 'border-slate-200 bg-white text-slate-900 focus:border-blue-500'}`}
        placeholder="Password akun"
        autoFocus
      />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={isLoading} className={`rounded-full px-4 py-2 text-sm font-semibold ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>Batal</button>
        <button type="button" onClick={onConfirm} disabled={isLoading || !password.trim()} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">Konfirmasi</button>
      </div>
    </section>
  </div>
);

const ThinkingLoader: React.FC<{ step: string; steps: string[]; liveThinking?: string; fallbackLines?: string[] }> = ({ step, steps, liveThinking, fallbackLines = FALLBACK_THINKING_LINES }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [typedText, setTypedText] = useState('');
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const title = steps === IMAGE_ANALYSIS_STEPS
    ? 'Menganalisis gambar'
    : steps === FILE_ANALYSIS_STEPS
      ? 'Menganalisis file'
      : 'Thinking...';

  const hasLiveThinking = Boolean(liveThinking?.trim());
  const detailText = hasLiveThinking ? liveThinking!.trim() : fallbackLines[fallbackIndex];

  useEffect(() => {
    if (hasLiveThinking) return;

    const timer = window.setInterval(() => {
      setFallbackIndex((index) => (index + 1) % fallbackLines.length);
    }, 450);

    return () => window.clearInterval(timer);
  }, [fallbackLines.length, hasLiveThinking]);

  useEffect(() => {
    if (!isOpen) return;

    if (hasLiveThinking) {
      setTypedText(detailText);
      return;
    }

    if (!detailText.startsWith(typedText)) {
      setTypedText('');
      return;
    }

    let index = typedText.length;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedText(detailText.slice(0, index));

      if (index >= detailText.length) {
        window.clearInterval(timer);
      }
    }, 8);

    return () => window.clearInterval(timer);
  }, [detailText, hasLiveThinking, isOpen, typedText]);

  return (
    <div className="flex w-full mb-8 justify-start">
      <div className="flex max-w-[90%] flex-row items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100">
            <img
              src={APP_ICON_URL}
              alt="PUTRA AI STUDIO"
              className="h-6 w-6 object-contain"
            />
          </div>
        </div>
        <div className="min-w-0 pt-1">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="inline-flex text-left text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 focus:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-blue-300"
            title={isOpen ? 'Sembunyikan isi pikiran AI' : 'Tampilkan isi pikiran AI'}
            aria-expanded={isOpen}
          >
            {title}
          </button>
          {isOpen && (
            <p className="mt-1 min-h-5 max-w-3xl text-[13px] font-normal leading-6 text-slate-500/85 dark:text-slate-400/85">
              {typedText}
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-slate-400 dark:bg-slate-500" />
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ImageGenerationLoader: React.FC<{ step: string }> = ({ step }) => (
  <div className="flex w-full mb-8 justify-start">
    <div className="flex max-w-[92%] flex-row items-start gap-4">
      <div className="flex-shrink-0 mt-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-100">
          <img
            src={APP_ICON_URL}
            alt="PUTRA AI STUDIO"
            className="h-6 w-6 object-contain"
          />
        </div>
      </div>

      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-2 text-slate-700">
          <Sparkles size={16} className="text-blue-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          <p className="text-sm font-semibold text-slate-800">Membuat gambar</p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{step}</p>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTypingResponse, setIsTypingResponse] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState(THINKING_STEPS);
  const [activeThinkingText, setActiveThinkingText] = useState('');
  const [activeThinkingFallbackLines, setActiveThinkingFallbackLines] = useState(FALLBACK_THINKING_LINES);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(() => getStoredActiveView());
  
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('hidden');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [accountDevices, setAccountDevices] = useState<AccountDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [isDeviceLimitBlocked, setIsDeviceLimitBlocked] = useState(false);
  const [isDeviceRefreshing, setIsDeviceRefreshing] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [reauthDevice, setReauthDevice] = useState<AccountDevice | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [isReauthLoading, setIsReauthLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserStatusRole>('basic');
  const [roleExpiresAt, setRoleExpiresAt] = useState<string | null>(null);
  const [accountUsernameDraft, setAccountUsernameDraft] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isSubscribingPlan, setIsSubscribingPlan] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('putra-theme') === 'dark' ? 'dark' : 'light';
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const subscriptionBadge = userRole.toUpperCase();
  const isSendingRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToNewestUserMessage = useCallback(() => {
    window.requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.colorScheme = isDark ? 'dark' : 'light';
    window.localStorage.setItem('putra-theme', theme);
  }, [theme]);

  useEffect(() => {
    const setViewportVars = () => {
      const layoutHeight = window.innerHeight;
      const visualViewport = window.visualViewport;
      const keyboardInset = visualViewport
        ? Math.max(0, layoutHeight - visualViewport.height - visualViewport.offsetTop)
        : 0;

      document.documentElement.style.setProperty('--app-height', `${layoutHeight}px`);
      document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
      document.body.classList.toggle('keyboard-open', keyboardInset > 80);
      setIsKeyboardOpen(keyboardInset > 80);
    };

    setViewportVars();
    window.addEventListener('resize', setViewportVars);
    window.addEventListener('orientationchange', setViewportVars);
    window.visualViewport?.addEventListener('resize', setViewportVars);
    window.visualViewport?.addEventListener('scroll', setViewportVars);

    return () => {
      window.removeEventListener('resize', setViewportVars);
      window.removeEventListener('orientationchange', setViewportVars);
      window.visualViewport?.removeEventListener('resize', setViewportVars);
      window.visualViewport?.removeEventListener('scroll', setViewportVars);
      document.body.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);

  // Initialize Gemini and listen to Auth state
  useEffect(() => {
    geminiService.initChat();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const profile = await ensureUserDocument(currentUser);
          const deviceId = getClientDeviceId();
          const registration = await registerUserDevice(
            currentUser.uid,
            deviceId,
            getClientDeviceName(),
            getClientUserAgent(),
          );

          setUserRole(profile.status_role);
          setRoleExpiresAt(profile.roleExpiresAt || null);
          setAccountUsernameDraft(profile.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || '');
          setCurrentDeviceId(deviceId);
          setAccountDevices(registration.devices);
          setIsDeviceLimitBlocked(!registration.allowed);
          setAuthMode('hidden');

          if (!registration.allowed) {
            setActiveView('account');
            setError('DEVICE_LIMIT: Akun ini sudah aktif di 3 device. Logout salah satu device lama dulu untuk memakai device ini.');
            return;
          }

          await loadHistory(currentUser.uid);
        } catch (err) {
          setError(err instanceof Error ? `Kesalahan Firestore: ${err.message}` : 'Kesalahan Firestore: gagal memuat riwayat chat.');
        }
      } else {
        setChatHistory([]);
        setAccountDevices([]);
        setCurrentDeviceId('');
        setIsDeviceLimitBlocked(false);
        setUserRole('basic');
        setRoleExpiresAt(null);
        setAccountUsernameDraft('');
        setAuthMode('login');
      }
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!isLoading) {
      setThinkingStep(0);
      setActiveThinkingText('');
      return;
    }

    const timer = window.setInterval(() => {
      setThinkingStep((step) => (step + 1) % activeThinkingSteps.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [activeThinkingSteps, isLoading]);

  const loadHistory = async (uid: string) => {
    try {
      const history = await getUserChatHistory(uid);
      setChatHistory(history);
    } catch (err) {
      setChatHistory([]);
      throw err;
    }
  };


  const refreshAccountDevices = useCallback(async () => {
    if (!user) return;
    const deviceId = currentDeviceId || getClientDeviceId();

    setIsDeviceRefreshing(true);
    setDeviceError('');
    try {
      const devices = await getUserDevices(user.uid, deviceId);
      setCurrentDeviceId(deviceId);
      setAccountDevices(devices);
      setIsDeviceLimitBlocked(devices.filter((device) => device.active && device.id !== deviceId).length >= 3 && !devices.some((device) => device.active && device.id === deviceId));
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Gagal memuat daftar device.');
    } finally {
      setIsDeviceRefreshing(false);
    }
  }, [currentDeviceId, user]);

  useEffect(() => {
    if (!user || !currentDeviceId || isDeviceLimitBlocked) return;

    const heartbeat = window.setInterval(() => {
      updateUserDeviceHeartbeat(user.uid, currentDeviceId).catch((err) => {
        console.warn('[Putra Account] Device heartbeat failed:', err);
      });
    }, 60_000);

    return () => window.clearInterval(heartbeat);
  }, [currentDeviceId, isDeviceLimitBlocked, user]);

  const completeDeviceLogout = useCallback(async (device: AccountDevice) => {
    if (!user) return;
    await logoutUserDevice(user.uid, device.id);
    const deviceId = currentDeviceId || getClientDeviceId();
    const registration = await registerUserDevice(user.uid, deviceId, getClientDeviceName(), getClientUserAgent());
    setCurrentDeviceId(deviceId);
    setAccountDevices(registration.devices);
    setIsDeviceLimitBlocked(!registration.allowed);
    if (registration.allowed) {
      setError(null);
      await loadHistory(user.uid);
    }
  }, [currentDeviceId, user]);

  const requestLogoutDevice = useCallback(async (device: AccountDevice) => {
    if (!user || device.id === currentDeviceId) return;
    setDeviceError('');

    const providerIds = user.providerData.map((provider) => provider.providerId);
    if (providerIds.includes('password')) {
      setReauthPassword('');
      setReauthDevice(device);
      return;
    }

    try {
      setIsReauthLoading(true);
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await completeDeviceLogout(device);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Verifikasi akun gagal.');
    } finally {
      setIsReauthLoading(false);
    }
  }, [completeDeviceLogout, currentDeviceId, user]);

  const confirmPasswordDeviceLogout = useCallback(async () => {
    if (!user || !reauthDevice || !user.email) return;
    setIsReauthLoading(true);
    setDeviceError('');

    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      await completeDeviceLogout(reauthDevice);
      setReauthDevice(null);
      setReauthPassword('');
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Password salah atau verifikasi gagal.');
    } finally {
      setIsReauthLoading(false);
    }
  }, [completeDeviceLogout, reauthDevice, reauthPassword, user]);

  const updateLocalHistory = useCallback((sessionId: string, title: string, sessionMessages: Message[]) => {
    const nextSession: ChatSession = {
      id: sessionId,
      title,
      updatedAt: new Date().toISOString(),
      messages: sessionMessages,
    };

    setChatHistory(prev => [
      nextSession,
      ...prev.filter(session => session.id !== sessionId),
    ]);
  }, []);

  const handleSendMessage = useCallback(async (text: string, attachments: Attachment[] = []) => {
    if (isSendingRef.current || isLoading || isTypingResponse) return;
    if (!text.trim() && attachments.length === 0) return;

    if (!user) {
      setAuthMode('login');
      setError('Silakan masuk atau buat akun sebelum mulai chat.');
      return;
    }

    if (isDeviceLimitBlocked) {
      setActiveView('account');
      setError('DEVICE_LIMIT: Akun ini sudah aktif di 3 device. Logout salah satu device lama dulu.');
      return;
    }

    isSendingRef.current = true;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
      attachments
    };

    const updatedMessagesAfterUser = [...messages, newUserMessage];
    const isVisionRequest = attachments.some((attachment) => attachment.mimeType.startsWith('image/'));
    const shouldCreateDocx = wantsDocxFile(text);
    setActiveThinkingSteps(getThinkingSteps(text, attachments));
    setActiveThinkingFallbackLines(getFallbackThinkingLines(text));
    setActiveThinkingText('');
    setMessages(updatedMessagesAfterUser);
    scrollToNewestUserMessage();
    setIsLoading(true);
    setError(null);

    // Determine session ID and Title
    let sessionId = currentSessionId;
    let sessionTitle = '';
    
    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
      // Create title from text or attachment name
      if (text.trim()) {
        sessionTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      } else if (attachments.length > 0) {
        sessionTitle = `File: ${attachments[0].name}`;
      } else {
        sessionTitle = 'Chat Baru';
      }
    } else {
      // Find existing title from history
      const existingSession = chatHistory.find(s => s.id === sessionId);
      sessionTitle = existingSession ? existingSession.title : 'Sesi Chat';
    }

    updateLocalHistory(sessionId, sessionTitle, updatedMessagesAfterUser);

    if (user) {
      try {
        await saveChatSession(user.uid, sessionId, sessionTitle, updatedMessagesAfterUser);
      } catch (err) {
        setError(err instanceof Error ? `Gagal menyimpan ke Firestore: ${err.message}` : 'Gagal menyimpan ke Firestore.');
      }
    }

    try {
      const streamingMessageId = (Date.now() + 1).toString();
      let hasStreamingContent = false;
      let latestStreamText = '';

      const authToken = await user.getIdToken();
      const aiResponse = await geminiService.sendMessage(text, attachments, messages, {
        authToken,
        userId: user.uid,
        sessionId,
        onThinking: setActiveThinkingText,
        onContent: (content) => {
          if (isVisionRequest) return;

          const cleanContent = content.trim();
          if (!cleanContent) return;

          hasStreamingContent = true;
          latestStreamText = cleanContent;
          setActiveThinkingText('');
          setIsLoading(false);
          setIsTypingResponse(false);
          setMessages((currentMessages) => {
            const streamingMessage: Message = {
              id: streamingMessageId,
              role: 'model',
              text: cleanContent,
              timestamp: new Date(),
              imageBase64: '',
              mode: isVisionRequest ? 'vision' : 'text',
              downloadDocx: shouldCreateDocx,
              docxTitle: shouldCreateDocx ? getDocxTitle(text) : undefined,
              animateTyping: false,
              isStreaming: true,
            };

            if (currentMessages.some((message) => message.id === streamingMessageId)) {
              return currentMessages.map((message) =>
                message.id === streamingMessageId ? { ...message, ...streamingMessage } : message,
              );
            }

            return [...currentMessages, streamingMessage];
          });
        },
      });
      
      const newModelMessage: Message = {
        id: streamingMessageId,
        role: 'model',
        text: aiResponse.text || latestStreamText,
        timestamp: new Date(),
        imageBase64: aiResponse.imageBase64,
        mode: aiResponse.mode,
        downloadDocx: shouldCreateDocx,
        docxTitle: shouldCreateDocx ? getDocxTitle(text) : undefined,
        animateTyping: !hasStreamingContent,
        isStreaming: false,
      };
      
      const finalMessages = [...updatedMessagesAfterUser, newModelMessage];
      setIsTypingResponse(!hasStreamingContent);
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === streamingMessageId)) {
          return currentMessages.map((message) =>
            message.id === streamingMessageId ? newModelMessage : message,
          );
        }

        return [...currentMessages, newModelMessage];
      });
      updateLocalHistory(sessionId, sessionTitle, finalMessages);

      // Save to Firebase if logged in
      if (user && sessionId) {
        await saveChatSession(user.uid, sessionId, sessionTitle, finalMessages);
      }

      if (hasStreamingContent) {
        isSendingRef.current = false;
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak terduga.');
      setIsTypingResponse(false);
      isSendingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentSessionId, user, userRole, chatHistory, updateLocalHistory, isLoading, isTypingResponse, isDeviceLimitBlocked, scrollToNewestUserMessage]);

  const handleTypingComplete = useCallback((messageId: string) => {
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === messageId ? { ...message, animateTyping: false } : message,
      ),
    );
    setIsTypingResponse(false);
    isSendingRef.current = false;
  }, []);

  const handleNewChat = () => {
    geminiService.resetChat();
    setActiveView('chat');
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    setIsTypingResponse(false);
    isSendingRef.current = false;
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    geminiService.resetChat(); // Reset context for new session
    setActiveView('chat');
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setError(null);
    setIsTypingResponse(false);
    isSendingRef.current = false;
    setIsSidebarOpen(false);
  };

  const handleOpenPackages = () => {
    setActiveView('packages');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleOpenAccount = () => {
    setActiveView('account');
    setError(null);
    setShowUserMenu(false);
    setIsSidebarOpen(false);
    refreshAccountDevices();
  };

  const handleOpenVoice = () => {
    setActiveView('voice');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleOpenPpt = () => {
    setActiveView('ppt');
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleOpenConvert = (view: 'convert-word-pdf' | 'convert-ppt-pdf') => {
    setActiveView(view);
    setError(null);
    setIsSidebarOpen(false);
  };

  const handleSaveUsername = useCallback(async () => {
    if (!user) return;
    const nextName = accountUsernameDraft.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!nextName) {
      setDeviceError('Username tidak boleh kosong.');
      return;
    }

    setIsSavingUsername(true);
    setDeviceError('');
    try {
      await updateProfile(user, { displayName: nextName });
      await updateUserDisplayName(user.uid, nextName);
      setAccountUsernameDraft(nextName);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Gagal menyimpan username.');
    } finally {
      setIsSavingUsername(false);
    }
  }, [accountUsernameDraft, user]);

  const handleSelectPlan = useCallback(async (plan: 'pro' | 'plus') => {
    if (!user) {
      setAuthMode('login');
      return;
    }

    setIsSubscribingPlan(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/account/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, months: 1 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengaktifkan paket.');
      }

      setUserRole(data.profile.status_role);
      setRoleExpiresAt(data.profile.roleExpiresAt || null);
      setActiveView('account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan paket.');
    } finally {
      setIsSubscribingPlan(false);
    }
  }, [user]);

  const handleLogout = async () => {
    if (user && currentDeviceId) {
      await logoutUserDevice(user.uid, currentDeviceId).catch(() => undefined);
    }
    await signOut(auth);
    setShowUserMenu(false);
    handleNewChat();
  };

  const isEmptyChat = messages.length === 0;
  const username = user?.displayName || accountUsernameDraft || user?.email?.split('@')[0] || '';
  const isDarkTheme = theme === 'dark';

  return (
    <div className={`putra-theme-root flex h-[var(--app-height,100dvh)] w-full overflow-hidden font-sans transition-colors ${isKeyboardOpen ? 'putra-keyboard-open' : ''} ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'
    }`}>
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onNewChat={handleNewChat}
        onOpenPackages={handleOpenPackages}
        onOpenAccount={handleOpenAccount}
        onOpenVoice={handleOpenVoice}
        onOpenPpt={handleOpenPpt}
        onOpenConvert={handleOpenConvert}
        activeView={activeView}
        history={chatHistory}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        isLoggedIn={!!user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative min-w-0">
        
        {/* Header */}
        <header className={`sticky top-0 z-10 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-md transition-colors md:px-6 md:pb-4 md:pt-[calc(env(safe-area-inset-top)+1rem)] ${
          isDarkTheme
            ? 'border-b border-slate-800 bg-slate-950/92'
            : 'border-b border-slate-100/70 bg-white/90'
        }`}>
          <div className="flex min-w-0 items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`rounded-full p-2 transition-colors ${
                isDarkTheme ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label="Buka riwayat chat"
            >
              <Menu size={24} />
            </button>
            <button
              type="button"
              className="min-w-0 flex items-center gap-2 text-left"
              onClick={handleNewChat}
            >
              <span className={`truncate text-lg font-semibold md:text-xl ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                PUTRA AI PLUS
              </span>
              <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold leading-4 text-blue-700">
                {subscriptionBadge}
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
                isDarkTheme
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium shadow-sm hover:bg-blue-700 transition-colors"
                >
                  {username ? username.charAt(0).toUpperCase() : <UserIcon size={18} />}
                </button>
                
                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleOpenAccount();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ShieldCheck size={16} />
                      Informasi akun
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <LogOut size={16} />
                      Keluar
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {/* Chat Area */}
        {activeView === 'packages' ? (
          <PutraPackages userRole={userRole} roleExpiresAt={roleExpiresAt} isSubscribing={isSubscribingPlan} onSelectPlan={handleSelectPlan} />
        ) : activeView === 'account' && user ? (
          <AccountPage
            user={user}
            userRole={userRole}
            roleExpiresAt={roleExpiresAt}
            devices={accountDevices}
            currentDeviceId={currentDeviceId}
            isDark={isDarkTheme}
            isBlocked={isDeviceLimitBlocked}
            error={deviceError}
            usernameDraft={accountUsernameDraft}
            isSavingUsername={isSavingUsername}
            isRefreshing={isDeviceRefreshing}
            onUsernameChange={setAccountUsernameDraft}
            onSaveUsername={handleSaveUsername}
            onRefresh={refreshAccountDevices}
            onLogoutDevice={requestLogoutDevice}
          />
        ) : activeView === 'convert-word-pdf' ? (
          <PutraConvert mode="word-pdf" />
        ) : activeView === 'convert-ppt-pdf' ? (
          <PutraConvert mode="ppt-pdf" />
        ) : activeView === 'voice' ? (
          <SoreaVoice
            isLoggedIn={!!user}
            onRequireLogin={() => {
              setAuthMode('login');
              setError('Silakan masuk atau buat akun sebelum menggunakan Putra Voice.');
            }}
          />
        ) : activeView === 'ppt' ? (
          <PutraPpt />
        ) : (
        <main className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain transition-colors ${
          isDarkTheme ? 'bg-slate-950' : 'bg-white'
        } ${isEmptyChat ? '' : 'pb-64 md:pb-56'}`}>
          {isEmptyChat ? (
            // Empty State / Greeting
            <div className={`relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10 transition-colors ${
              theme === 'dark' ? 'bg-slate-950' : 'bg-white'
            }`}>
              <div
                className={`pointer-events-none absolute inset-0 ${theme === 'dark' ? 'hidden' : 'block'}`}
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.18) 0%, rgba(147, 197, 253, 0.12) 28%, rgba(255, 255, 255, 0.78) 58%, #ffffff 100%)',
                }}
              />
              <div
                className={`pointer-events-none absolute inset-0 ${theme === 'dark' ? 'block' : 'hidden'}`}
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(37, 99, 235, 0.34) 0%, rgba(124, 58, 237, 0.22) 24%, rgba(15, 23, 42, 0.96) 52%, #020617 100%)',
                }}
              />
              <div className={`relative z-10 flex w-full max-w-[760px] flex-col items-center gap-7 transition-transform sm:-translate-y-5 ${isKeyboardOpen ? '-translate-y-24' : '-translate-y-8'}`}>
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative">
                    <div className={`absolute inset-[-18px] rounded-full blur-2xl ${
                      isDarkTheme ? 'bg-blue-500/20' : 'bg-blue-400/20'
                    }`} />
                    <div className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full shadow-sm ring-1 ${
                      isDarkTheme ? 'bg-slate-900/95 ring-slate-700' : 'bg-white/90 ring-blue-100'
                    }`}>
                      <img
                        src={APP_ICON_URL}
                        alt="PUTRA AI STUDIO"
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h2 className={`text-balance text-[30px] font-semibold leading-tight tracking-normal sm:text-5xl ${
                      isDarkTheme ? 'text-slate-50' : 'text-slate-800'
                    }`}>
                      Mau mulai dari apa hari ini?
                    </h2>
                    {username && (
                      <div className="flex justify-center">
                        <span className={`max-w-[80vw] truncate rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm ring-1 sm:text-base ${
                          isDarkTheme
                            ? 'bg-slate-900/80 text-blue-200 ring-slate-700'
                            : 'bg-white/80 text-blue-700 ring-blue-100'
                        }`}>
                          {username}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full max-w-[720px]">
                  <ChatInput
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading || isTypingResponse || !user}
                    variant="hero"
                    placeholder="Tulis pesan untuk PUTRA AI"
                    theme={theme}
                  />
                  {error && <ErrorNotice error={error} compact isDark={isDarkTheme} />}
                </div>
              </div>
            </div>
          ) : (
            // Messages List
            <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} onTypingComplete={handleTypingComplete} />
              ))}
              
              {isLoading && (
                isImageGenerationStepSet(activeThinkingSteps) ? (
                  <ImageGenerationLoader step={activeThinkingSteps[thinkingStep]} />
                ) : (
                  <ThinkingLoader
                    step={activeThinkingSteps[thinkingStep]}
                    steps={activeThinkingSteps}
                    liveThinking={activeThinkingText}
                    fallbackLines={activeThinkingFallbackLines}
                  />
                )
              )}
              
              {error && <ErrorNotice error={error} isDark={isDarkTheme} />}
              
              <div ref={chatBottomRef} className="h-36 md:h-32" />
            </div>
          )}
        </main>
        )}

        {/* Input Area Fixed at Bottom */}
        {activeView === 'chat' && !isEmptyChat && (
        <div
          style={{ bottom: 'var(--keyboard-inset, 0px)' }}
          className={`absolute left-0 w-full bg-gradient-to-t px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-10 transition-[background-color,opacity,bottom] md:px-6 ${
            isDarkTheme
              ? 'from-slate-950 via-slate-950 to-transparent'
              : 'from-white via-white to-transparent'
          }`}
        >
          <div className="max-w-3xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || isTypingResponse || !user} theme={theme} />
            <div className="text-center mt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                &copy; 2026 PUTRA AI STUDIO.{' '}
                <a
                  href="https://www.putraaistudioapikey.site/#privacy"
                  className="font-medium text-slate-600 underline underline-offset-2 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  Kebijakan & Privasi
                </a>
              </p>
            </div>
          </div>
        </div>
        )}

      </div>

      {reauthDevice && (
        <ReauthDeviceModal
          deviceName={reauthDevice.name}
          password={reauthPassword}
          isDark={isDarkTheme}
          error={deviceError}
          isLoading={isReauthLoading}
          onPasswordChange={setReauthPassword}
          onCancel={() => {
            setReauthDevice(null);
            setReauthPassword('');
          }}
          onConfirm={confirmPasswordDeviceLogout}
        />
      )}

      {/* Auth Modal */}
      <AuthModal 
        mode={authMode} 
        onClose={() => user && setAuthMode('hidden')} 
        onChangeMode={setAuthMode} 
        canClose={!!user}
      />

    </div>
  );
};

export default App;



