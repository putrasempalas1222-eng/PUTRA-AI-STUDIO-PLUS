import { PptData } from './pptService';

const encoder = new TextEncoder();
const SLIDE_W = 12192000;
const SLIDE_H = 6858000;

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFileName(value: string) {
  const clean = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean || 'putra-ppt').slice(0, 80);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function appendBytes(target: number[], bytes: Uint8Array | number[]) {
  for (let index = 0; index < bytes.length; index += 1) {
    target.push(bytes[index]);
  }
}

function createZip(entries: Array<{ name: string; content: string | Uint8Array }>) {
  const output: number[] = [];
  const centralDirectory: number[] = [];

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const contentBytes = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
    const checksum = crc32(contentBytes);
    const offset = output.length;

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, checksum);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    appendBytes(output, nameBytes);
    appendBytes(output, contentBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, checksum);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, offset);
    appendBytes(centralDirectory, nameBytes);
  });

  const centralDirectoryOffset = output.length;
  appendBytes(output, centralDirectory);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, entries.length);
  writeUint16(output, entries.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralDirectoryOffset);
  writeUint16(output, 0);

  return new Uint8Array(output);
}

function textParagraph(text: string, size = 2800, color = '0F172A', bold = false, bullet = false) {
  return `<a:p>${bullet ? '<a:pPr marL="342900" indent="-171450"><a:buChar char="&#8226;"/></a:pPr>' : '<a:pPr/>'}<a:r><a:rPr lang="id-ID" sz="${size}"${bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r></a:p>`;
}

function textShape(id: number, x: number, y: number, w: number, h: number, paragraphs: string[]) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${paragraphs.join('')}</p:txBody></p:sp>`;
}

function imageBytes(imageBase64?: string) {
  if (!imageBase64) return null;
  const clean = imageBase64.includes(',') ? imageBase64.split(',').pop() || '' : imageBase64;
  try {
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function imageShape(id: number, relationshipId: string, x: number, y: number, w: number, h: number) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Slide image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></p:spPr></p:pic>`;
}

function shouldUseSlideImage(ppt: PptData, index: number) {
  const slide = ppt.slides[index];
  if (!slide?.imageBase64) return false;

  const maxImages = Math.min(3, Math.max(1, Math.ceil(ppt.slides.length / 3)));
  const usedBefore = ppt.slides
    .slice(0, index)
    .filter((_, slideIndex) => shouldUseSlideImageCandidate(ppt, slideIndex))
    .length;

  return shouldUseSlideImageCandidate(ppt, index) && usedBefore < maxImages;
}

function shouldUseSlideImageCandidate(ppt: PptData, index: number) {
  const slide = ppt.slides[index];
  const title = `${index === 0 ? ppt.title : ''} ${slide?.title || ''}`.toLowerCase();
  if (index === 0) return true;
  if (index === Math.floor(ppt.slides.length / 2)) return true;
  return /\b(contoh|penerapan|proses|alur|arsitektur|diagram|visual|implementasi|hasil|demo|studi|manfaat)\b/i.test(title);
}

function slideXml(ppt: PptData, index: number) {
  const slide = ppt.slides[index];
  const palette = [
    ['EEF6FF', 'DBEAFE', '2563EB'],
    ['F7F3FF', 'EDE9FE', '7C3AED'],
    ['FFF7ED', 'FFEDD5', 'EA580C'],
    ['F0FDF4', 'DCFCE7', '16A34A'],
  ][index % 4];
  const isCover = index === 0;
  const title = isCover ? ppt.title : slide.title;
  const subtitle = isCover ? (ppt.subtitle || slide.title) : '';
  const points = (slide.points || []).slice(0, isCover ? 4 : 6);
  const hasImage = shouldUseSlideImage(ppt, index) && Boolean(imageBytes(slide.imageBase64));
  const imageBlock = hasImage ? imageShape(8, 'rId1', 7600000, 1600000, 3600000, 2450000) : '';
  const titleWidth = hasImage ? 6200000 : 7600000;
  const pointsWidth = hasImage ? 6100000 : 8600000;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${palette[0]}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/><a:chOff x="0" y="0"/><a:chExt cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm></p:grpSpPr>
      <p:sp><p:nvSpPr><p:cNvPr id="2" name="Accent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="390000" cy="${SLIDE_H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${palette[2]}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>
      <p:sp><p:nvSpPr><p:cNvPr id="3" name="Soft block"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="7600000" y="380000"/><a:ext cx="3600000" cy="2100000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${palette[1]}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>
      ${imageBlock}
      ${textShape(4, 760000, isCover ? 1180000 : 700000, titleWidth, isCover ? 1450000 : 900000, [textParagraph(title, isCover ? 3800 : 3300, '0F172A', true)])}
      ${subtitle ? textShape(5, 760000, 2700000, 6500000, 700000, [textParagraph(subtitle, 2100, '475569')]) : ''}
      ${textShape(6, 900000, isCover ? 3750000 : 1950000, pointsWidth, isCover ? 1900000 : 3400000, points.map((point) => textParagraph(point, 1850, '1E293B', false, true)))}
      ${textShape(7, 9300000, 6220000, 2100000, 260000, [textParagraph('PUTRA AI PLUS', 1050, '64748B', true)])}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function slideRelsXml(index: number, hasImage: boolean) {
  if (!hasImage) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.png"/></Relationships>`;
}

function presentationXml(slideCount: number) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function presentationRels(slideCount: number) {
  const rels = Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

export function createPptxBlob(ppt: PptData) {
  const images = ppt.slides.map((slide, index) => (shouldUseSlideImage(ppt, index) ? imageBytes(slide.imageBase64) : null));
  const entries = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${ppt.slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    },
    { name: 'ppt/presentation.xml', content: presentationXml(ppt.slides.length) },
    { name: 'ppt/_rels/presentation.xml.rels', content: presentationRels(ppt.slides.length) },
    ...ppt.slides.map((_, index) => ({ name: `ppt/slides/slide${index + 1}.xml`, content: slideXml(ppt, index) })),
    ...ppt.slides.map((_, index) => ({ name: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: slideRelsXml(index, Boolean(images[index])) })),
    ...images.flatMap((bytes, index) => (bytes ? [{ name: `ppt/media/image${index + 1}.png`, content: bytes }] : [])),
  ];

  return new Blob([createZip(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export function downloadPptx(ppt: PptData) {
  const blob = createPptxBlob(ppt);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(ppt.title)}.pptx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
