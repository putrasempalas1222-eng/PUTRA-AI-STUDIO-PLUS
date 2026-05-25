import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Phone, X } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  linkWithPhoneNumber,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, ensureUserDocument } from '../services/firebase';

export type AuthMode = 'login' | 'register' | 'forgot' | 'phone' | 'hidden';

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onChangeMode: (mode: AuthMode) => void;
  canClose?: boolean;
}

const googleProvider = new GoogleAuthProvider();
const countryOptions = [
  { code: 'ID', name: 'Indonesia', dialCode: '+62' },
  { code: 'AF', name: 'Afghanistan', dialCode: '+93' },
  { code: 'AL', name: 'Albania', dialCode: '+355' },
  { code: 'DZ', name: 'Algeria', dialCode: '+213' },
  { code: 'AD', name: 'Andorra', dialCode: '+376' },
  { code: 'AO', name: 'Angola', dialCode: '+244' },
  { code: 'AR', name: 'Argentina', dialCode: '+54' },
  { code: 'AM', name: 'Armenia', dialCode: '+374' },
  { code: 'AU', name: 'Australia', dialCode: '+61' },
  { code: 'AT', name: 'Austria', dialCode: '+43' },
  { code: 'AZ', name: 'Azerbaijan', dialCode: '+994' },
  { code: 'BH', name: 'Bahrain', dialCode: '+973' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880' },
  { code: 'BY', name: 'Belarus', dialCode: '+375' },
  { code: 'BE', name: 'Belgium', dialCode: '+32' },
  { code: 'BZ', name: 'Belize', dialCode: '+501' },
  { code: 'BJ', name: 'Benin', dialCode: '+229' },
  { code: 'BT', name: 'Bhutan', dialCode: '+975' },
  { code: 'BO', name: 'Bolivia', dialCode: '+591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dialCode: '+387' },
  { code: 'BW', name: 'Botswana', dialCode: '+267' },
  { code: 'BR', name: 'Brazil', dialCode: '+55' },
  { code: 'BN', name: 'Brunei', dialCode: '+673' },
  { code: 'BG', name: 'Bulgaria', dialCode: '+359' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226' },
  { code: 'BI', name: 'Burundi', dialCode: '+257' },
  { code: 'KH', name: 'Cambodia', dialCode: '+855' },
  { code: 'CM', name: 'Cameroon', dialCode: '+237' },
  { code: 'CA', name: 'Canada', dialCode: '+1' },
  { code: 'CL', name: 'Chile', dialCode: '+56' },
  { code: 'CN', name: 'China', dialCode: '+86' },
  { code: 'CO', name: 'Colombia', dialCode: '+57' },
  { code: 'CG', name: 'Congo', dialCode: '+242' },
  { code: 'CR', name: 'Costa Rica', dialCode: '+506' },
  { code: 'HR', name: 'Croatia', dialCode: '+385' },
  { code: 'CU', name: 'Cuba', dialCode: '+53' },
  { code: 'CY', name: 'Cyprus', dialCode: '+357' },
  { code: 'CZ', name: 'Czech Republic', dialCode: '+420' },
  { code: 'DK', name: 'Denmark', dialCode: '+45' },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253' },
  { code: 'DO', name: 'Dominican Republic', dialCode: '+1' },
  { code: 'EC', name: 'Ecuador', dialCode: '+593' },
  { code: 'EG', name: 'Egypt', dialCode: '+20' },
  { code: 'SV', name: 'El Salvador', dialCode: '+503' },
  { code: 'EE', name: 'Estonia', dialCode: '+372' },
  { code: 'ET', name: 'Ethiopia', dialCode: '+251' },
  { code: 'FJ', name: 'Fiji', dialCode: '+679' },
  { code: 'FI', name: 'Finland', dialCode: '+358' },
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'GA', name: 'Gabon', dialCode: '+241' },
  { code: 'GE', name: 'Georgia', dialCode: '+995' },
  { code: 'DE', name: 'Germany', dialCode: '+49' },
  { code: 'GH', name: 'Ghana', dialCode: '+233' },
  { code: 'GR', name: 'Greece', dialCode: '+30' },
  { code: 'GT', name: 'Guatemala', dialCode: '+502' },
  { code: 'GN', name: 'Guinea', dialCode: '+224' },
  { code: 'HT', name: 'Haiti', dialCode: '+509' },
  { code: 'HN', name: 'Honduras', dialCode: '+504' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852' },
  { code: 'HU', name: 'Hungary', dialCode: '+36' },
  { code: 'IS', name: 'Iceland', dialCode: '+354' },
  { code: 'IN', name: 'India', dialCode: '+91' },
  { code: 'IR', name: 'Iran', dialCode: '+98' },
  { code: 'IQ', name: 'Iraq', dialCode: '+964' },
  { code: 'IE', name: 'Ireland', dialCode: '+353' },
  { code: 'IL', name: 'Israel', dialCode: '+972' },
  { code: 'IT', name: 'Italy', dialCode: '+39' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1' },
  { code: 'JP', name: 'Japan', dialCode: '+81' },
  { code: 'JO', name: 'Jordan', dialCode: '+962' },
  { code: 'KZ', name: 'Kazakhstan', dialCode: '+7' },
  { code: 'KE', name: 'Kenya', dialCode: '+254' },
  { code: 'KR', name: 'Korea Selatan', dialCode: '+82' },
  { code: 'KW', name: 'Kuwait', dialCode: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', dialCode: '+996' },
  { code: 'LA', name: 'Laos', dialCode: '+856' },
  { code: 'LV', name: 'Latvia', dialCode: '+371' },
  { code: 'LB', name: 'Lebanon', dialCode: '+961' },
  { code: 'LY', name: 'Libya', dialCode: '+218' },
  { code: 'LT', name: 'Lithuania', dialCode: '+370' },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352' },
  { code: 'MO', name: 'Macau', dialCode: '+853' },
  { code: 'MG', name: 'Madagascar', dialCode: '+261' },
  { code: 'MW', name: 'Malawi', dialCode: '+265' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60' },
  { code: 'MV', name: 'Maldives', dialCode: '+960' },
  { code: 'ML', name: 'Mali', dialCode: '+223' },
  { code: 'MT', name: 'Malta', dialCode: '+356' },
  { code: 'MX', name: 'Mexico', dialCode: '+52' },
  { code: 'MD', name: 'Moldova', dialCode: '+373' },
  { code: 'MN', name: 'Mongolia', dialCode: '+976' },
  { code: 'MA', name: 'Morocco', dialCode: '+212' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258' },
  { code: 'MM', name: 'Myanmar', dialCode: '+95' },
  { code: 'NP', name: 'Nepal', dialCode: '+977' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64' },
  { code: 'NI', name: 'Nicaragua', dialCode: '+505' },
  { code: 'NE', name: 'Niger', dialCode: '+227' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234' },
  { code: 'NO', name: 'Norway', dialCode: '+47' },
  { code: 'OM', name: 'Oman', dialCode: '+968' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92' },
  { code: 'PA', name: 'Panama', dialCode: '+507' },
  { code: 'PG', name: 'Papua New Guinea', dialCode: '+675' },
  { code: 'PY', name: 'Paraguay', dialCode: '+595' },
  { code: 'PE', name: 'Peru', dialCode: '+51' },
  { code: 'PH', name: 'Philippines', dialCode: '+63' },
  { code: 'PL', name: 'Poland', dialCode: '+48' },
  { code: 'PT', name: 'Portugal', dialCode: '+351' },
  { code: 'QA', name: 'Qatar', dialCode: '+974' },
  { code: 'RO', name: 'Romania', dialCode: '+40' },
  { code: 'RU', name: 'Russia', dialCode: '+7' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
  { code: 'SN', name: 'Senegal', dialCode: '+221' },
  { code: 'RS', name: 'Serbia', dialCode: '+381' },
  { code: 'SG', name: 'Singapura', dialCode: '+65' },
  { code: 'SK', name: 'Slovakia', dialCode: '+421' },
  { code: 'SI', name: 'Slovenia', dialCode: '+386' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27' },
  { code: 'ES', name: 'Spain', dialCode: '+34' },
  { code: 'LK', name: 'Sri Lanka', dialCode: '+94' },
  { code: 'SD', name: 'Sudan', dialCode: '+249' },
  { code: 'SE', name: 'Sweden', dialCode: '+46' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41' },
  { code: 'SY', name: 'Syria', dialCode: '+963' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886' },
  { code: 'TJ', name: 'Tajikistan', dialCode: '+992' },
  { code: 'TZ', name: 'Tanzania', dialCode: '+255' },
  { code: 'TH', name: 'Thailand', dialCode: '+66' },
  { code: 'TL', name: 'Timor-Leste', dialCode: '+670' },
  { code: 'TN', name: 'Tunisia', dialCode: '+216' },
  { code: 'TR', name: 'Turkey', dialCode: '+90' },
  { code: 'TM', name: 'Turkmenistan', dialCode: '+993' },
  { code: 'UG', name: 'Uganda', dialCode: '+256' },
  { code: 'UA', name: 'Ukraine', dialCode: '+380' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { code: 'US', name: 'Amerika Serikat', dialCode: '+1' },
  { code: 'UY', name: 'Uruguay', dialCode: '+598' },
  { code: 'UZ', name: 'Uzbekistan', dialCode: '+998' },
  { code: 'VE', name: 'Venezuela', dialCode: '+58' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84' },
  { code: 'YE', name: 'Yemen', dialCode: '+967' },
  { code: 'ZM', name: 'Zambia', dialCode: '+260' },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263' },
];

function normalizePhoneNumber(value: string, dialCode: string) {
  const clean = value.replace(/[^\d+]/g, '').trim();
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return `${dialCode}${clean.slice(1)}`;
  if (clean.startsWith(dialCode.replace('+', ''))) return `+${clean}`;
  return `${dialCode}${clean}`;
}

export const AuthModal: React.FC<AuthModalProps> = ({ mode, onClose, onChangeMode, canClose = true }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('ID');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (mode !== 'phone') {
      setConfirmation(null);
      setOtpCode('');
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'phone' || confirmation) {
      return;
    }

    let cancelled = false;
    setRecaptchaReady(false);

    const frameId = window.requestAnimationFrame(async () => {
      try {
        const verifier = getRecaptchaVerifier();
        await verifier.render();
        if (!cancelled) {
          setRecaptchaReady(true);
        }
      } catch (err) {
        console.error('[PUTRA Auth] reCAPTCHA render failed:', err);
        if (!cancelled) {
          setError(getAuthErrorMessage(err));
        }
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [mode, confirmation]);

  if (mode === 'hidden') return null;

  const getAuthErrorMessage = (err: unknown) => {
    if (!(err instanceof FirebaseError)) {
      return 'Terjadi kesalahan. Silakan coba lagi.';
    }

    const rawMessage = String(err.message || '').toLowerCase();
    if (err.code === 'auth/operation-not-allowed' && rawMessage.includes('region')) {
      return 'SMS OTP belum diizinkan untuk region nomor ini. Aktifkan region SMS negara nomor tersebut di Firebase Authentication.';
    }

    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email atau kata sandi salah. Jika belum punya akun, silakan daftar dulu.';
      case 'auth/email-already-in-use':
        return 'Email ini sudah terdaftar. Silakan masuk atau gunakan reset kata sandi.';
      case 'auth/credential-already-in-use':
        return 'Nomor telepon ini sudah dipakai akun lain.';
      case 'auth/invalid-verification-code':
        return 'Kode OTP tidak valid.';
      case 'auth/invalid-phone-number':
        return 'Format nomor telepon tidak valid. Gunakan format 08... atau +62...';
      case 'auth/missing-phone-number':
        return 'Nomor telepon wajib diisi.';
      case 'auth/captcha-check-failed':
        return 'Verifikasi reCAPTCHA gagal. Coba kirim OTP lagi.';
      case 'auth/invalid-app-credential':
        return 'Token reCAPTCHA tidak valid atau kedaluwarsa. Centang reCAPTCHA lalu kirim OTP lagi.';
      case 'auth/app-not-authorized':
      case 'auth/unauthorized-domain':
        return 'Domain aplikasi belum diizinkan untuk Firebase Authentication.';
      case 'auth/quota-exceeded':
        return 'Kuota SMS Firebase sudah habis atau terlalu banyak percobaan.';
      case 'auth/popup-closed-by-user':
        return 'Login Google dibatalkan.';
      case 'auth/invalid-email':
        return 'Format email tidak valid.';
      case 'auth/missing-password':
        return 'Kata sandi wajib diisi.';
      case 'auth/weak-password':
        return 'Kata sandi minimal 6 karakter.';
      case 'auth/too-many-requests':
        return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
      case 'auth/network-request-failed':
        return 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.';
      case 'auth/operation-not-allowed':
        return 'Provider login ini belum aktif, atau region SMS nomor ini belum diizinkan di Firebase Authentication.';
      default:
        return err.message || 'Terjadi kesalahan. Silakan coba lagi.';
    }
  };

  const getRecaptchaVerifier = () => {
    if (!recaptchaRef.current) {
      const container = document.getElementById('putra-phone-recaptcha');
      if (!container) {
        throw new Error('reCAPTCHA belum siap. Muat ulang halaman lalu coba lagi.');
      }

      recaptchaRef.current = new RecaptchaVerifier(auth, container, {
        size: 'normal',
        callback: () => setError(''),
        'expired-callback': () => {
          setRecaptchaReady(false);
          setConfirmation(null);
          setError('reCAPTCHA kedaluwarsa. Centang ulang lalu kirim OTP lagi.');
        },
      });
    }

    return recaptchaRef.current;
  };

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const selectedCountry = countryOptions.find((country) => country.code === countryCode) || countryOptions[0];

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextCode = otpCode.padEnd(6, ' ').split('');
    nextCode[index] = digit || ' ';
    const normalizedCode = nextCode.join('').replace(/\s/g, '');
    setOtpCode(normalizedCode);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtpCode(pastedCode);
    otpInputRefs.current[Math.min(pastedCode.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        setError('Email wajib diisi.');
        return;
      }

      if (mode !== 'forgot' && !password) {
        setError('Kata sandi wajib diisi.');
        return;
      }

      if (mode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        onChangeMode(credential.user.phoneNumber ? 'hidden' : 'phone');
      } else if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await ensureUserDocument(credential.user);
        onChangeMode('phone');
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, normalizedEmail);
        setSuccessMsg('Email reset kata sandi sudah dikirim. Periksa kotak masuk Anda.');
      }
    } catch (err) {
      console.error('[PUTRA Auth] Email auth failed:', err);
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    resetMessages();
    setLoading(true);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserDocument(credential.user);
      onChangeMode(credential.user.phoneNumber ? 'hidden' : 'phone');
    } catch (err) {
      console.error('[PUTRA Auth] Google login failed:', err);
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Silakan login atau daftar terlebih dahulu.');
        return;
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber, selectedCountry.dialCode);
      if (!normalizedPhone.startsWith('+')) {
        setError('Gunakan format nomor yang valid.');
        return;
      }

      const verifier = getRecaptchaVerifier();
      const result = await linkWithPhoneNumber(user, normalizedPhone, verifier);
      setConfirmation(result);
      setSuccessMsg(`Kode OTP sudah dikirim ke ${normalizedPhone}.`);
    } catch (err) {
      console.error('[PUTRA Auth] Send OTP failed:', err);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setRecaptchaReady(false);
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (!confirmation) {
        setError('Kirim OTP terlebih dahulu.');
        return;
      }

      if (!otpCode.trim()) {
        setError('Kode OTP wajib diisi.');
        return;
      }

      const credential = await confirmation.confirm(otpCode.trim());
      await ensureUserDocument(credential.user);
      setSuccessMsg('Nomor telepon berhasil diverifikasi.');
      onClose();
    } catch (err) {
      console.error('[PUTRA Auth] Verify OTP failed:', err);
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPhone = async () => {
    if (canClose) {
      onClose();
      return;
    }

    await signOut(auth);
  };

  const title = mode === 'login'
    ? 'Masuk'
    : mode === 'register'
      ? 'Buat Akun'
      : mode === 'phone'
        ? 'Verifikasi Nomor'
        : 'Reset Kata Sandi';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          {(canClose || mode === 'phone') && (
            <button
              onClick={mode === 'phone' ? handleCancelPhone : onClose}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100"
              aria-label={canClose ? 'Tutup modal' : 'Keluar'}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {successMsg && mode !== 'phone' && (
            <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-600">
              {successMsg}
            </div>
          )}

          {mode === 'phone' ? (
            <div className="space-y-4">
              {!confirmation ? (
                <>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                    Nomor telepon wajib diverifikasi dengan OTP sebelum akun bisa digunakan.
                  </div>

                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Negara</label>
                        <select
                          value={countryCode}
                          onChange={(event) => setCountryCode(event.target.value)}
                          className="h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        >
                          {countryOptions.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.code} {country.dialCode}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Nomor Telepon</label>
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d\s-]/g, ''))}
                          className="h-[46px] w-full rounded-xl border border-slate-200 px-4 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                          placeholder="81234567890"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>CAPTCHA</span>
                        {!recaptchaReady && <span>Memuat...</span>}
                      </div>
                      <div className="min-h-[78px] overflow-hidden">
                        <div id="putra-phone-recaptcha" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !recaptchaReady}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
                    >
                      <Phone size={18} />
                      {loading ? 'Mengirim OTP...' : recaptchaReady ? 'Kirim OTP' : 'Menyiapkan CAPTCHA...'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm leading-6 text-green-800">
                    Kode OTP sudah dikirim ke {normalizePhoneNumber(phoneNumber, selectedCountry.dialCode)}.
                  </div>

                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Kode OTP</label>
                      <div className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              otpInputRefs.current[index] = element;
                            }}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={otpCode[index] || ''}
                            onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                            onKeyDown={(event) => handleOtpKeyDown(index, event)}
                            onPaste={handleOtpPaste}
                            className="h-12 w-full rounded-xl border border-slate-200 text-center text-lg font-semibold text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    >
                      {loading ? 'Memverifikasi...' : 'Verifikasi OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        recaptchaRef.current?.clear();
                        recaptchaRef.current = null;
                        setRecaptchaReady(false);
                        setConfirmation(null);
                        setOtpCode('');
                        setSuccessMsg('');
                      }}
                      className="w-full text-sm font-medium text-blue-600 hover:underline"
                    >
                      Ubah nomor telepon
                    </button>
                  </form>
                </>
              )}

              {!canClose && (
                <button
                  type="button"
                  onClick={handleCancelPhone}
                  className="w-full text-sm font-medium text-slate-500 hover:text-red-600"
                >
                  Keluar dari akun ini
                </button>
              )}
            </div>
          ) : (
            <>
              {mode !== 'forgot' && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-70"
                  >
                    <KeyRound size={18} />
                    Masuk dengan Google
                  </button>

                  <div className="mb-4 flex items-center gap-3 text-xs font-medium text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    atau
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Alamat Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="nama@email.com"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Kata Sandi</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="********"
                    />
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onChangeMode('forgot')}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Lupa kata sandi?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
                >
                  {loading ? 'Mohon tunggu...' : (
                    mode === 'login' ? 'Masuk' :
                    mode === 'register' ? 'Daftar' : 'Kirim Link Reset'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                {mode === 'login' ? (
                  <p>Belum punya akun? <button onClick={() => onChangeMode('register')} className="font-medium text-blue-600 hover:underline">Daftar</button></p>
                ) : (
                  <p>Sudah punya akun? <button onClick={() => onChangeMode('login')} className="font-medium text-blue-600 hover:underline">Masuk</button></p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
