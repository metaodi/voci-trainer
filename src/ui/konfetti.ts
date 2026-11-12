// Einfaches Konfetti auf einem Canvas – ohne Bibliothek.

const FARBEN = ['#5b4fe0', '#8f85ff', '#1d9465', '#35c48b', '#f5b301', '#e57a12', '#d93a72', '#2f6fdf'];

interface Teil {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dreh: number;
  vdreh: number;
  b: number;
  h: number;
  farbe: string;
  wackel: number;
}

export function konfetti(anzahl = 120): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'konfetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const groesse = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  groesse();
  window.addEventListener('resize', groesse);

  const teile: Teil[] = Array.from({ length: anzahl }, (_, i) => {
    // Zwei "Kanonen" unten links und rechts
    const links = i % 2 === 0;
    const winkel = (links ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const tempo = 11 + Math.random() * 9;
    return {
      x: links ? -10 : innerWidth + 10,
      y: innerHeight * 0.75,
      vx: Math.cos(winkel) * tempo,
      vy: Math.sin(winkel) * tempo,
      dreh: Math.random() * Math.PI,
      vdreh: (Math.random() - 0.5) * 0.3,
      b: 7 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      farbe: FARBEN[i % FARBEN.length],
      wackel: Math.random() * Math.PI * 2,
    };
  });

  const start = performance.now();
  const DAUER = 3200;
  const bild = (t: number) => {
    const alter = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of teile) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.wackel += 0.12;
      p.x += p.vx + Math.sin(p.wackel) * 0.8;
      p.y += p.vy;
      p.dreh += p.vdreh;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, alter - DAUER + 800) / 800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.dreh);
      ctx.scale(1, Math.cos(p.wackel));
      ctx.fillStyle = p.farbe;
      ctx.fillRect(-p.b / 2, -p.h / 2, p.b, p.h);
      ctx.restore();
    }
    if (alter < DAUER) requestAnimationFrame(bild);
    else {
      window.removeEventListener('resize', groesse);
      canvas.remove();
    }
  };
  requestAnimationFrame(bild);
}
