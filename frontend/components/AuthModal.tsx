import React, { useState } from 'react';
import { X } from 'lucide-react';
import { auth } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';

export type AuthMode = 'login' | 'register' | 'forgot' | 'hidden';

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onChangeMode: (mode: AuthMode) => void;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ mode, onClose, onChangeMode, canClose = true }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (mode === 'hidden') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('Email reset kata sandi sudah dikirim. Periksa kotak masuk Anda.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">
            {mode === 'login' && 'Masuk'}
            {mode === 'register' && 'Buat Akun'}
            {mode === 'forgot' && 'Reset Kata Sandi'}
          </h2>
          {canClose && (
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors" aria-label="Tutup modal">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="nama@email.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kata Sandi</label>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
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
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70"
            >
              {loading ? 'Mohon tunggu...' : (
                mode === 'login' ? 'Masuk' : 
                mode === 'register' ? 'Daftar' : 'Kirim Link Reset'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm text-slate-600">
            {mode === 'login' ? (
              <p>Belum punya akun? <button onClick={() => onChangeMode('register')} className="text-blue-600 font-medium hover:underline">Daftar</button></p>
            ) : (
              <p>Sudah punya akun? <button onClick={() => onChangeMode('login')} className="text-blue-600 font-medium hover:underline">Masuk</button></p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
