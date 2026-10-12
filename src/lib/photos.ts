import type { Photo } from './types';

function isLive() {
  try {
    return localStorage.getItem('serena-hub-mode') === 'live';
  } catch {
    return false;
  }
}

/** Generates a clearly-labelled illustrative "photo" for demo records (no real Serena imagery is used). */
export function demoPhoto(label: string, hue = 150, variant = 0): string {
  const h2 = (hue + 25) % 360;
  const shapes = [
    `<rect x="120" y="120" width="400" height="230" rx="10" fill="hsl(${hue},12%,30%)"/><rect x="150" y="150" width="140" height="80" rx="4" fill="hsl(${hue},20%,15%)"/><circle cx="380" cy="190" r="34" fill="hsl(${hue},10%,45%)" stroke="hsl(${hue},10%,70%)" stroke-width="5"/><line x1="380" y1="190" x2="400" y2="168" stroke="#f5c542" stroke-width="5"/><rect x="460" y="150" width="30" height="180" fill="hsl(${hue},10%,22%)"/><circle cx="175" cy="300" r="10" fill="#4ade80"/><circle cx="210" cy="300" r="10" fill="#f97316"/>`,
    `<rect x="90" y="180" width="460" height="120" rx="60" fill="hsl(${hue},14%,35%)"/><rect x="60" y="215" width="60" height="50" fill="hsl(${hue},10%,25%)"/><rect x="520" y="215" width="70" height="50" fill="hsl(${hue},10%,25%)"/><circle cx="320" cy="240" r="46" fill="hsl(${hue},8%,50%)"/><circle cx="320" cy="240" r="20" fill="hsl(${hue},8%,28%)"/>`,
    `<rect x="170" y="90" width="300" height="300" rx="12" fill="hsl(${hue},8%,82%)"/><rect x="200" y="120" width="240" height="70" rx="6" fill="hsl(${hue},20%,18%)"/><text x="320" y="168" font-family="monospace" font-size="38" fill="#7CFC9A" text-anchor="middle">${variant ? '27.4' : '26.9'} V</text><circle cx="250" cy="260" r="26" fill="hsl(${hue},10%,60%)"/><circle cx="390" cy="260" r="26" fill="hsl(${hue},10%,60%)"/>`,
    `<path d="M60 330 Q200 260 320 300 T580 290 L580 420 L60 420Z" fill="hsl(${hue},15%,25%)"/><rect x="230" y="140" width="40" height="190" fill="hsl(${hue},10%,55%)"/><rect x="230" y="200" width="200" height="40" fill="hsl(${hue},10%,55%)"/><circle cx="430" cy="220" r="34" fill="hsl(${hue},10%,40%)"/><ellipse cx="300" cy="350" rx="60" ry="10" fill="hsl(200,60%,55%)" opacity=".7"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},18%,62%)"/><stop offset="1" stop-color="hsl(${h2},22%,30%)"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/>${shapes[variant % shapes.length]}<rect x="0" y="420" width="640" height="60" fill="rgba(0,0,0,.55)"/><text x="20" y="458" font-family="Helvetica,Arial" font-size="22" fill="#fff">${escapeXml(label)}</text><text x="620" y="458" font-family="Helvetica,Arial" font-size="15" fill="#f4ead2" text-anchor="end">${isLive() ? 'NO PHOTO YET' : 'DEMO IMAGE'}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 15 * 1024 * 1024;

/** Validates and compresses an image on-device before it is stored (max 1280px, JPEG ~0.7). */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') && !ALLOWED.includes(file.type)) throw new Error(`${file.name} is not an image.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`Could not read ${file.name}.`));
      i.src = url;
    });
    const max = 1024;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.62);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function makePhoto(dataUrl: string, userId: string, stage: Photo['stage'], caption = '', fieldId?: string, at = new Date().toISOString()): Photo {
  return { id: `ph-${Math.random().toString(36).slice(2, 10)}`, dataUrl, caption, stage, fieldId, uploadedById: userId, at };
}
