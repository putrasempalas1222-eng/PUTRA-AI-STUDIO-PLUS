import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Layers3, Loader2, Palette, Sparkles } from 'lucide-react';
import { generatePptContent, PptData, PptSlide } from '../services/pptService';
import { downloadPptx } from '../services/pptx';

const sampleTopic = 'Rancang Bangun Aplikasi Pemindaian QR Code untuk Menampilkan Data 3D Dokumen dan Gambar Berbasis Web dan Android';

const loadingSteps = [
  'Membaca topik presentasi',
  'Menyusun struktur slide',
  'Menata poin dan catatan',
];

const deckThemes = [
  {
    name: 'Akademik',
    accent: 'from-blue-600 to-cyan-500',
    bg: 'from-slate-50 via-blue-50 to-white',
    mark: 'bg-blue-600',
    soft: 'bg-blue-50',
    text: 'text-blue-700',
  },
  {
    name: 'Profesional',
    accent: 'from-emerald-600 to-teal-500',
    bg: 'from-slate-50 via-emerald-50 to-white',
    mark: 'bg-emerald-600',
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  {
    name: 'Kreatif',
    accent: 'from-violet-600 to-rose-500',
    bg: 'from-slate-50 via-violet-50 to-white',
    mark: 'bg-violet-600',
    soft: 'bg-violet-50',
    text: 'text-violet-700',
  },
];

function clampSlideCount(value: number) {
  if (!Number.isFinite(value)) return 6;
  return Math.min(15, Math.max(3, Math.round(value)));
}

function normalizeSlide(slide: PptSlide, index: number): PptSlide {
  return {
    title: slide.title || `Slide ${index + 1}`,
    points: (slide.points || []).filter(Boolean).slice(0, 6),
    speakerNotes: slide.speakerNotes,
    imageBase64: slide.imageBase64,
  };
}

function getSlideImageSrc(slide: PptSlide) {
  if (!slide.imageBase64) return '';
  return slide.imageBase64.startsWith('data:')
    ? slide.imageBase64
    : `data:image/png;base64,${slide.imageBase64}`;
}

function shouldUseVisualImage(slides: PptSlide[], index: number) {
  const slide = slides[index];
  if (!slide?.imageBase64) return false;

  const maxImages = Math.min(3, Math.max(1, Math.ceil(slides.length / 3)));
  const candidateIndexes = slides
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item, itemIndex }) => {
      if (!item.imageBase64) return false;
      const title = item.title.toLowerCase();
      return itemIndex === 0 ||
        itemIndex === Math.floor(slides.length / 2) ||
        /\b(contoh|penerapan|proses|alur|arsitektur|diagram|visual|implementasi|hasil|demo|studi|manfaat)\b/i.test(title);
    })
    .slice(0, maxImages)
    .map(({ itemIndex }) => itemIndex);

  return candidateIndexes.includes(index);
}

export const PutraPpt: React.FC = () => {
  const [topic, setTopic] = useState(sampleTopic);
  const [slideCount, setSlideCount] = useState(6);
  const [language, setLanguage] = useState('Indonesia');
  const [themeIndex, setThemeIndex] = useState(0);
  const [ppt, setPpt] = useState<PptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');

  const theme = deckThemes[themeIndex];
  const currentStep = loadingSteps[stepIndex];

  const slides = useMemo(
    () => (ppt?.slides || []).map(normalizeSlide),
    [ppt]
  );

  const visualSlideIndexes = useMemo(
    () => slides.map((_, index) => index).filter((index) => shouldUseVisualImage(slides, index)),
    [slides]
  );

  useEffect(() => {
    if (!isLoading) {
      setStepIndex(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setStepIndex((value) => (value + 1) % loadingSteps.length);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Topik PPT wajib diisi.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await generatePptContent(topic.trim(), clampSlideCount(slideCount), language);
      if (!result.slides.length) {
        throw new Error('Worker tidak mengirim slide. Coba ulangi dengan topik yang lebih jelas.');
      }
      setPpt(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat PPT.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-3 py-4 sm:px-4 md:grid-cols-[340px_minmax(0,1fr)] md:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="self-start rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <FileText size={21} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-slate-900">Putra PPT</h1>
                <p className="text-sm text-slate-500">Generator presentasi</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Judul atau topik</label>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                disabled={isLoading}
                className="min-h-40 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-70"
                placeholder="Contoh: Dampak AI terhadap pendidikan di Indonesia"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Jumlah</label>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={slideCount}
                  disabled={isLoading}
                  onChange={(event) => setSlideCount(clampSlideCount(Number(event.target.value)))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-70"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Bahasa</label>
                <select
                  value={language}
                  disabled={isLoading}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-70"
                >
                  <option value="Indonesia">Indonesia</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Palette size={16} />
                Gaya slide
              </label>
              <div className="grid grid-cols-3 gap-2">
                {deckThemes.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setThemeIndex(index)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                      themeIndex === index
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`mx-auto mb-1 block h-2 w-10 rounded-full bg-gradient-to-r ${item.accent}`} />
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {isLoading ? 'Membuat PPT...' : 'Generate PPT'}
            </button>

            {ppt && (
              <button
                type="button"
                onClick={() => downloadPptx(ppt)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <Download size={18} />
                Simpan jadi PPTX
              </button>
            )}

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0">
          {isLoading ? (
            <div className={`relative min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br ${theme.bg} p-4 shadow-sm sm:p-6`}>
              <div className="absolute right-8 top-8 grid grid-cols-8 gap-2 opacity-50">
                {Array.from({ length: 64 }).map((_, index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                    style={{ animationDelay: `${index * 35}ms` }}
                  />
                ))}
              </div>
              <div className="relative flex h-full min-h-[500px] flex-col justify-between">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                    <Loader2 size={16} className="animate-spin" />
                    {currentStep}
                  </div>
                  <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                    Menyiapkan deck presentasi
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{topic}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {loadingSteps.map((step, index) => (
                    <div key={step} className="rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm">
                      <span className={`mb-4 block h-1.5 w-12 rounded-full bg-gradient-to-r ${theme.accent}`} />
                      <p className="text-sm font-semibold text-slate-800">{step}</p>
                      <p className="mt-2 text-xs text-slate-500">Tahap {index + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : !ppt ? (
            <div className={`relative min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br ${theme.bg} p-4 shadow-sm sm:p-6`}>
              <div className="absolute -right-20 top-12 h-72 w-72 rounded-full bg-white/65 blur-2xl" />
              <div className="absolute bottom-8 right-8 hidden w-64 grid-cols-5 gap-3 opacity-60 md:grid">
                {Array.from({ length: 25 }).map((_, index) => (
                  <span key={index} className="h-2 w-2 rounded-full bg-slate-400/70" />
                ))}
              </div>
              <div className="relative flex min-h-[500px] flex-col justify-between">
                <div>
                  <div className={`mb-5 inline-flex items-center gap-2 rounded-full ${theme.soft} px-3 py-1.5 text-sm font-semibold ${theme.text}`}>
                    <Layers3 size={16} />
                    {slideCount} slide
                  </div>
                  <h2 className="max-w-3xl text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl md:text-5xl">
                    {topic || 'Tulis topik PPT Anda'}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
                    Preview deck akan muncul lengkap dengan judul, poin inti, catatan pembicara, dan tombol unduh PPTX.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {['Cover', 'Materi inti', 'Penutup'].map((item, index) => (
                    <div key={item} className="rounded-lg border border-white/75 bg-white/80 p-4 shadow-sm">
                      <span className={`mb-4 block h-1.5 w-12 rounded-full ${index === 1 ? theme.mark : 'bg-slate-300'}`} />
                      <p className="text-sm font-semibold text-slate-800">{item}</p>
                      <p className="mt-2 text-xs text-slate-500">Slide {index + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br ${theme.bg} shadow-sm`}>
                <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <p className={`mb-3 inline-flex rounded-full ${theme.soft} px-3 py-1 text-xs font-semibold ${theme.text}`}>
                      Deck Preview
                    </p>
                    <h2 className="text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl md:text-4xl">{ppt.title}</h2>
                    {ppt.subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{ppt.subtitle}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-white/80 bg-white/80 p-3">
                      <p className="text-xs text-slate-500">Slide</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">{slides.length}</p>
                    </div>
                    <div className="rounded-lg border border-white/80 bg-white/80 p-3">
                      <p className="text-xs text-slate-500">Bahasa</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{language}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {slides.map((slide, index) => {
                  const imageSrc = visualSlideIndexes.includes(index) ? getSlideImageSrc(slide) : '';
                  return (
                  <article
                    key={`${slide.title}-${index}`}
                    className={`min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br ${theme.bg} shadow-sm sm:min-h-[390px] xl:min-h-[430px]`}
                  >
                    <div className="relative flex h-full min-h-[inherit] flex-col p-5 sm:p-6">
                      <div className={`absolute inset-y-0 left-0 z-10 w-2 ${theme.mark}`} />
                      <span className={`relative text-xs font-semibold ${theme.text}`}>Slide {index + 1}</span>
                      <div className={`relative mt-3 grid flex-1 gap-5 ${imageSrc ? 'lg:grid-cols-[minmax(0,1fr)_240px]' : ''}`}>
                        <div className="flex min-w-0 flex-col">
                        <h3 className="text-xl font-semibold leading-snug text-slate-950 sm:text-2xl">
                          {slide.title}
                        </h3>
                        <ul className="mt-5 flex-1 space-y-3 text-base leading-7 text-slate-700">
                        {slide.points.map((point, pointIndex) => (
                          <li key={pointIndex} className="flex gap-2">
                            <span className={`mt-3 h-1.5 w-1.5 shrink-0 rounded-full ${theme.mark}`} />
                            <span>{point}</span>
                          </li>
                        ))}
                        </ul>
                        <p className="mt-5 self-end text-[10px] font-bold tracking-normal text-slate-400">
                          PUTRA AI PLUS
                        </p>
                        </div>
                        {imageSrc && (
                          <div className="relative min-h-52 overflow-hidden rounded-lg border border-white/80 bg-slate-100 shadow-sm lg:min-h-full">
                            <img
                              src={imageSrc}
                              alt={slide.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <div className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${theme.accent} opacity-30`} />
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
