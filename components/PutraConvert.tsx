import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, Upload } from 'lucide-react';
import { unzipSync, strFromU8 } from 'fflate';
import { createTextPdfBlob, downloadBlob } from '../services/pdf';

interface PutraConvertProps {
  mode: 'word-pdf' | 'ppt-pdf';
}

const modeContent = {
  'word-pdf': {
    title: 'Word ke PDF',
    description: 'Upload file Word lalu ubah menjadi PDF yang siap dibagikan.',
    accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    helper: 'Format yang didukung: DOC dan DOCX',
  },
  'ppt-pdf': {
    title: 'PPT ke PDF',
    description: 'Upload presentasi PowerPoint lalu simpan menjadi PDF.',
    accept: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    helper: 'Format yang didukung: PPT dan PPTX',
  },
};

export const PutraConvert: React.FC<PutraConvertProps> = ({ mode }) => {
  const content = modeContent[mode];
  const [status, setStatus] = useState<'idle' | 'converting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfName, setPdfName] = useState('');

  const selectedTitle = useMemo(() => {
    if (!pdfName) return content.title;
    return pdfName.replace(/\.pdf$/i, '');
  }, [content.title, pdfName]);

  const sanitizeFilename = (value: string) =>
    value.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim() || 'putra-convers';

  const convertWordToPdf = async (file: File) => {
    if (!/\.docx$/i.test(file.name)) {
      throw new Error('Untuk sementara Word ke PDF mendukung file DOCX. Simpan ulang file .doc menjadi .docx terlebih dahulu.');
    }

    const mammoth = await import('mammoth/mammoth.browser');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim() || 'Tidak ada teks yang dapat dibaca dari dokumen Word ini.';

    return createTextPdfBlob(file.name.replace(/\.[^.]+$/, ''), text);
  };

  const stripXml = (value: string) =>
    value
      .replace(/<a:br\s*\/>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

  const convertPptToPdf = async (file: File) => {
    if (!/\.pptx$/i.test(file.name)) {
      throw new Error('Untuk sementara PPT ke PDF mendukung file PPTX. Simpan ulang file .ppt menjadi .pptx terlebih dahulu.');
    }

    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const slideEntries = Object.keys(zip)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0));

    if (slideEntries.length === 0) {
      throw new Error('Slide PPTX tidak dapat dibaca.');
    }

    const text = slideEntries
      .map((name, index) => {
        const xml = strFromU8(zip[name]);
        const textMatches = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((match) => stripXml(match[1]));
        const slideText = textMatches.filter(Boolean).join('\n');
        return `Slide ${index + 1}\n${slideText || 'Tidak ada teks pada slide ini.'}`;
      })
      .join('\n\n');

    return createTextPdfBlob(file.name.replace(/\.[^.]+$/, ''), text);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setStatus('converting');
    setMessage(`Mengonversi ${file.name}...`);
    setPdfBlob(null);
    setPdfName('');

    try {
      const blob = mode === 'word-pdf' ? await convertWordToPdf(file) : await convertPptToPdf(file);
      const filename = `${sanitizeFilename(file.name.replace(/\.[^.]+$/, ''))}.pdf`;
      setPdfBlob(blob);
      setPdfName(filename);
      setStatus('done');
      setMessage('Konversi berhasil. File PDF sudah siap di-download.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Gagal mengonversi file.');
    }
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 md:px-6">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 md:px-7">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <FileText size={23} />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700">PUTRA CONVERS</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-900 md:text-4xl">
                {content.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                {content.description}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm md:p-8">
          <label className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 text-center transition-colors hover:bg-blue-50">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
              <Upload size={28} />
            </span>
            <span className="mt-5 text-lg font-semibold text-slate-900">Pilih file untuk dikonversi</span>
            <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">{content.helper}</span>
            <span className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
              Upload file
            </span>
            <input type="file" accept={content.accept} className="hidden" onChange={handleFileChange} />
          </label>
        </section>

        {status !== 'idle' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  status === 'error' ? 'bg-red-50 text-red-600' : status === 'done' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {status === 'converting' ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {status === 'converting' ? 'Sedang proses' : status === 'done' ? selectedTitle : 'Konversi gagal'}
                  </p>
                  <p className={`mt-1 text-sm leading-6 ${status === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
                    {message}
                  </p>
                </div>
              </div>

              {status === 'done' && pdfBlob && (
                <button
                  type="button"
                  onClick={() => downloadBlob(pdfBlob, pdfName)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <Download size={17} />
                  Download PDF
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
