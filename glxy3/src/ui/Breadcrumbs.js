// src/ui/Breadcrumbs.js
import { gameConfig } from '../config/gameConfig.js';

function ensureContainer() {
  let el = document.getElementById('breadcrumbs-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'breadcrumbs-bar';
    el.style.position = 'fixed';
    el.style.top = '8px';
    el.style.left = '12px';
    el.style.padding = '6px 10px';
    el.style.borderRadius = '8px';
    el.style.background = 'rgba(18, 20, 24, 0.6)';
    el.style.color = '#fff';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '14px';
    el.style.lineHeight = '1';
    el.style.backdropFilter = 'blur(2px)';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
    el.style.zIndex = '10000';
    el.style.pointerEvents = 'auto';
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.gap = '6px';
    document.body.appendChild(el);
  }
  return el;
}

function createSegment(label, onClick, isLast) {
  const span = document.createElement('span');
  span.textContent = label;
  span.style.display = 'inline-block';
  span.style.maxWidth = '28vw';
  span.style.whiteSpace = 'nowrap';
  span.style.textOverflow = 'ellipsis';
  span.style.overflow = 'hidden';
  if (typeof onClick === 'function') {
    span.style.cursor = 'pointer';
    span.style.color = isLast ? '#ffffff' : '#a9d4ff';
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      try { onClick(); } catch (err) { console.error('Breadcrumb click error:', err); }
    });
  } else {
    span.style.color = '#ffffff';
  }
  return span;
}

function createSeparator() {
  const sep = document.createElement('span');
  sep.textContent = ' \u203A '; // single right angle quote ›
  sep.style.opacity = '0.75';
  sep.style.margin = '0 4px';
  return sep;
}

export function updateBreadcrumbs({
  star = null,
  planetIndex = null,
  moonIndex = null,
  onGalaxy = null,
  onStar = null,
  onPlanet = null,
  onMoon = null,
} = {}) {
  const container = ensureContainer();
  // Clear previous content
  container.innerHTML = '';
  const args = { star, planetIndex, moonIndex, onGalaxy, onStar, onPlanet, onMoon };

  const segments = [];
  // Galaxy root
  segments.push({ label: 'Галактика', onClick: onGalaxy });

  if (star) {
    const starLabel = star.name || (gameConfig?.exploration?.unexploredSystemName || 'Система');
    segments.push({ label: starLabel, onClick: onStar });

    if (planetIndex !== null && planetIndex !== undefined) {
      const planet = star?.planets?.planets?.[planetIndex];
      const planetLabel = planet?.name || `Планета ${Number(planetIndex) + 1}`;
      segments.push({ label: planetLabel, onClick: onPlanet });

      if (moonIndex !== null && moonIndex !== undefined) {
        const moon = planet?.moons?.[moonIndex];
        const moonLabel = moon?.name || `Луна ${Number(moonIndex) + 1}`;
        segments.push({ label: moonLabel, onClick: onMoon });
      }
    }
  }

  // Render segments with separators
  segments.forEach((seg, idx) => {
    const isLast = idx === segments.length - 1;
    container.appendChild(createSegment(seg.label, seg.onClick, isLast));
    if (!isLast) container.appendChild(createSeparator());
  });
}