const encoder = new TextEncoder();

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, (char) => {
      const normalized = char.normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
      return normalized || ' ';
    });

const wrapText = (text: string, maxChars = 88) => {
  const lines: string[] = [];
  const paragraphs = text.replace(/\t/g, '  ').split(/\n+/);

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      return;
    }

    let line = '';
    words.forEach((word) => {
      const nextLine = line ? `${line} ${word}` : word;
      if (nextLine.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    });

    if (line) lines.push(line);
    lines.push('');
  });

  return lines;
};

const chunkLines = (lines: string[], maxLines = 42) => {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines));
  }

  return pages.length ? pages : [['']];
};

const createPageStream = (title: string, lines: string[], pageNumber: number, totalPages: number) => {
  const content: string[] = [
    'BT',
    '/F1 18 Tf',
    '54 790 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -30 Td',
  ];

  lines.forEach((line) => {
    content.push(`(${escapePdfText(line)}) Tj`);
    content.push('0 -16 Td');
  });

  content.push('ET');
  content.push('BT');
  content.push('/F1 9 Tf');
  content.push('54 32 Td');
  content.push(`(PUTRA AI PLUS - Halaman ${pageNumber} dari ${totalPages}) Tj`);
  content.push('ET');

  return content.join('\n');
};

export const createTextPdfBlob = (title: string, text: string) => {
  const wrappedLines = wrapText(text || 'Tidak ada teks yang dapat dibaca dari file.');
  const pages = chunkLines(wrappedLines);
  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const streamObjectId = pageObjectId + 1;
    const stream = createPageStream(title, pageLines, index + 1, pages.length);
    const streamLength = encoder.encode(stream).length;

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${streamObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([encoder.encode(pdf)], { type: 'application/pdf' });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
