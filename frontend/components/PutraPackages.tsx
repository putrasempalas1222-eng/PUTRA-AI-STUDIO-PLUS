import React from 'react';
import { Check, Crown, Sparkles, Zap } from 'lucide-react';

const packages = [
  {
    name: 'Basic',
    price: 'Rp 0',
    period: 'selamanya',
    description: 'Untuk mencoba fitur utama PUTRA AI PLUS.',
    icon: Sparkles,
    tone: 'blue',
    badge: 'Aktif',
    features: [
      'Chat AI dasar',
      'Riwayat chat',
      'Upload gambar dan file terbatas',
      'Putra Voice dasar',
    ],
    action: 'Paket saat ini',
  },
  {
    name: 'Pro',
    price: 'Rp 200.000',
    period: 'per bulan',
    description: 'Untuk belajar, kerja, dan membuat konten lebih cepat.',
    icon: Zap,
    tone: 'emerald',
    badge: 'Populer',
    features: [
      'Chat AI lebih cepat',
      'Generate gambar prioritas',
      'Analisis PDF, Word, dan TXT lebih panjang',
      'Putra PPT dengan desain siap pakai',
      'Riwayat chat lebih banyak',
    ],
    action: 'Pilih Pro',
  },
  {
    name: 'Plus',
    price: 'Rp 750.000',
    period: 'per bulan',
    description: 'Untuk pengguna intensif yang butuh batas lebih besar.',
    icon: Crown,
    tone: 'violet',
    badge: 'Maksimal',
    features: [
      'Semua fitur Pro',
      'Limit penggunaan lebih besar',
      'Generate PPT dan gambar prioritas tinggi',
      'Analisis dokumen lebih detail',
      'Akses fitur baru lebih awal',
    ],
    action: 'Pilih Plus',
  },
];

const toneClasses = {
  blue: {
    card: 'border-blue-100 bg-blue-50/40',
    icon: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-700',
    button: 'bg-slate-900 text-white hover:bg-slate-800',
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/50',
    icon: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-700',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
  violet: {
    card: 'border-violet-200 bg-violet-50/50',
    icon: 'bg-violet-600 text-white',
    badge: 'bg-violet-100 text-violet-700',
    button: 'bg-violet-600 text-white hover:bg-violet-700',
  },
};

export const PutraPackages: React.FC = () => {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">PUTRA AI PLUS</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-900 md:text-4xl">
                Paket penggunaan
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                Pilih paket sesuai kebutuhan untuk chat, analisis file, generate gambar, Putra Voice, dan Putra PPT.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
              Basic aktif untuk semua akun
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {packages.map((item) => {
            const Icon = item.icon;
            const tone = toneClasses[item.tone as keyof typeof toneClasses];

            return (
              <article
                key={item.name}
                className={`flex min-h-[430px] flex-col rounded-2xl border p-5 shadow-sm ${tone.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone.icon}`}>
                    <Icon size={21} />
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                    {item.badge}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-xl font-semibold text-slate-900">{item.name}</h2>
                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{item.description}</p>
                  <div className="mt-5 flex items-end gap-2">
                    <span className="text-3xl font-semibold tracking-normal text-slate-950">{item.price}</span>
                    <span className="pb-1 text-sm font-medium text-slate-500">{item.period}</span>
                  </div>
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-slate-200">
                        <Check size={13} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${tone.button}`}
                >
                  {item.action}
                </button>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
};
