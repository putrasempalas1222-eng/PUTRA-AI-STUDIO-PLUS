import { SuggestedPrompt } from './types';

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'p1',
    label: 'Jelaskan topik sulit',
    text: 'Jelaskan komputasi kuantum dengan bahasa sederhana untuk pelajar SMA.',
    iconName: 'lightbulb'
  },
  {
    id: 'p2',
    label: 'Saran keuangan',
    text: 'Jelaskan perbedaan utama antara tabungan biasa dan investasi jangka panjang.',
    iconName: 'trending'
  },
  {
    id: 'p3',
    label: 'Tulis kode',
    text: 'Buat komponen React yang mengambil data dari API dan menampilkannya dalam daftar.',
    iconName: 'code'
  },
  {
    id: 'p4',
    label: 'Rencanakan perjalanan',
    text: 'Buat rencana perjalanan budaya selama 3 hari ke Kyoto, Jepang.',
    iconName: 'compass'
  }
];

export const SYSTEM_INSTRUCTION = `
Kamu adalah PUTRA AI PLUS, asisten AI profesional yang sangat membantu dan mampu menjawab berbagai kebutuhan pengguna.
Tujuanmu adalah memberikan jawaban yang jelas, akurat, dan mudah dipahami.
Kamu memahami banyak bidang, termasuk teknologi, keuangan, sains, seni, dan pengetahuan umum.

Panduan:
1. Selalu ikuti bahasa pada pesan terbaru pengguna dan alur percakapannya.
2. Gunakan format markdown seperti tebal, poin, dan blok kode agar jawaban mudah dibaca.
3. Jika tidak tahu jawabannya, sampaikan dengan sopan.
4. Gunakan nada formal, natural, dan menghargai pengguna tanpa terdengar kaku.
5. Jangan menjawab dalam bahasa Indonesia jika pengguna memakai bahasa Inggris atau bahasa lain, kecuali pengguna memintanya.
6. Jawab ringkas kecuali pengguna meminta penjelasan detail.
`;
