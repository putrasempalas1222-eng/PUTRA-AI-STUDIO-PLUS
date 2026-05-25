export interface PptSlide {
  title: string;
  points: string[];
  speakerNotes?: string;
  imageBase64?: string;
}

export interface PptData {
  title: string;
  subtitle?: string;
  slides: PptSlide[];
}

const DEFAULT_API_BASE_URL = 'https://api-mzmdqh3n6a-uc.a.run.app';

function getPptApiUrl() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  return `${apiBaseUrl}/api/ppt`;
}

export async function generatePptContent(topic: string, slideCount: number, language: string): Promise<PptData> {
  const response = await fetch(getPptApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic, slideCount, language }),
  });
  const data = await response.json();

  if (!response.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'Gagal membuat isi PPT.');
  }

  const ppt = data.data as PptData;
  return {
    title: String(ppt?.title || topic).trim(),
    subtitle: ppt?.subtitle ? String(ppt.subtitle).trim() : undefined,
    slides: (Array.isArray(ppt?.slides) ? ppt.slides : []).map((slide, index) => ({
      title: String(slide?.title || `Slide ${index + 1}`).trim(),
      points: (Array.isArray(slide?.points) ? slide.points : [])
        .map((point) => String(point || '').trim())
        .filter(Boolean)
        .slice(0, 6),
      speakerNotes: slide?.speakerNotes ? String(slide.speakerNotes).trim() : undefined,
      imageBase64: slide?.imageBase64 ? String(slide.imageBase64).trim() : undefined,
    })),
  };
}
