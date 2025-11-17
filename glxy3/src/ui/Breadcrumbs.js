// src/ui/Breadcrumbs.js
import { gameConfig } from '../config/gameConfig.js';

// Simple dropdown state to avoid multiple open menus
let currentDropdown = null;
let outsideClickHandlerAttached = false;
let resizeHandlerAttached = false;

function closeDropdown() {
  if (currentDropdown && currentDropdown.parentNode) {
    try { currentDropdown.parentNode.removeChild(currentDropdown); } catch {}
  }
  currentDropdown = null;
}

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
    el.style.userSelect = 'none';
    // Make absolute children position relative to container
    el.style.position = 'fixed';
    document.body.appendChild(el);
  }

  if (!outsideClickHandlerAttached) {
    document.addEventListener('click', (e) => {
      const container = document.getElementById('breadcrumbs-bar');
      if (!container) return;
      if (!container.contains(e.target)) {
        closeDropdown();
      }
    });
    outsideClickHandlerAttached = true;
  }
  return el;
}

function createSegment(label, onClick, isLast, dropdownItems) {
  const span = document.createElement('span');
  span.textContent = label;
  span.style.display = 'inline-block';
  span.style.maxWidth = '28vw';
  span.style.whiteSpace = 'nowrap';
  span.style.textOverflow = 'ellipsis';
  span.style.overflow = 'hidden';
  const hasDropdown = Array.isArray(dropdownItems) && dropdownItems.length > 0;
  if (hasDropdown) {
    span.style.cursor = 'pointer';
    span.style.color = '#a9d4ff';
    span.title = 'Открыть список';
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = ensureContainer();
      // Toggle
      if (currentDropdown && currentDropdown._anchor === span) {
        closeDropdown();
        return;
      }
      closeDropdown();
      const dd = createDropdown(span, dropdownItems);
      container.appendChild(dd);
      currentDropdown = dd;
      currentDropdown._anchor = span;
    });
  } else if (typeof onClick === 'function') {
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

function createDropdown(anchorEl, items) {
  const container = ensureContainer();
  const dd = document.createElement('div');
  dd.style.position = 'absolute';
  dd.style.top = `${container.offsetHeight + 6}px`;
  dd.style.left = `${anchorEl.offsetLeft}px`;
  dd.style.minWidth = '180px';
  dd.style.maxWidth = '60vw';
  dd.style.background = 'rgba(20, 24, 28, 0.95)';
  dd.style.border = '1px solid rgba(120,130,140,0.35)';
  dd.style.borderRadius = '8px';
  dd.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)';
  dd.style.padding = '6px';
  dd.style.zIndex = '10001';
  dd.style.backdropFilter = 'blur(2px)';

  items.forEach(({ label, onClick, underline }) => {
    const item = document.createElement('div');
    item.textContent = label;
    item.style.padding = '6px 10px';
    item.style.cursor = 'pointer';
    item.style.borderRadius = '6px';
    item.style.color = '#e9eef4';
    item.style.whiteSpace = 'nowrap';
    item.style.textOverflow = 'ellipsis';
    item.style.overflow = 'hidden';
    if (underline) item.style.textDecoration = 'underline';
    item.addEventListener('mouseenter', () => { item.style.background = 'rgba(60, 80, 105, 0.35)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      try { onClick?.(); } catch (err) { console.error('Dropdown click error:', err); }
    });
    dd.appendChild(item);
  });

  return dd;
}

export function updateBreadcrumbs({
  star = null,
  planetIndex = null,
  moonIndex = null,
  onGalaxy = null,
  onStar = null,
  onPlanet = null,
  onMoon = null,
  // Extended handlers for selection from dropdowns
  onPlanetIndex = null,
  onMoonIndex = null,
} = {}) {
  const container = ensureContainer();
  container.innerHTML = '';
  closeDropdown();
  const args = { star, planetIndex, moonIndex, onGalaxy, onStar, onPlanet, onMoon };

  const segments = [];
  // Galaxy root
  segments.push({ label: 'Галактика', onClick: onGalaxy });

  if (star) {
    const starLabel = star.name || (gameConfig?.exploration?.unexploredSystemName || 'Система');
    // Build dropdown of planets for star segment if available
    const planetList = Array.isArray(star?.planets?.planets) ? star.planets.planets : [];
    // Первый пункт — сама звёздная система (подчеркнутый)
    const starDropdown = [{
      label: starLabel,
      onClick: () => { try { onStar?.(); } catch (err) { console.error('onStar error:', err); } },
      underline: true
    }];
    // Далее — список планет
    starDropdown.push(...planetList.map((p, idx) => ({
      label: p?.name || `Планета ${idx + 1}`,
      onClick: () => {
        if (typeof onPlanetIndex === 'function') {
          try { onPlanetIndex(idx); } catch (err) { console.error('onPlanetIndex error:', err); }
        } else if (typeof onPlanet === 'function') {
          try { onPlanet(); } catch (err) { console.error('onPlanet error:', err); }
        }
      }
    })));
    segments.push({ label: starLabel, onClick: onStar, dropdownItems: starDropdown });

    if (planetIndex !== null && planetIndex !== undefined) {
      const planet = star?.planets?.planets?.[planetIndex];
      const planetLabel = planet?.name || `Планета ${Number(planetIndex) + 1}`;
      // Build dropdown of moons for planet segment if available
      const moonList = Array.isArray(planet?.moons) ? planet.moons : [];
      // Первый пункт — сама планета (подчеркнутый)
      const planetDropdown = [{
        label: planetLabel,
        onClick: () => { try { onPlanet?.(); } catch (err) { console.error('onPlanet error:', err); } },
        underline: true
      }];
      // Далее — список лун
      planetDropdown.push(...moonList.map((m, idx) => ({
        label: m?.name || `Луна ${idx + 1}`,
        onClick: () => {
          if (typeof onMoonIndex === 'function') {
            try { onMoonIndex(idx); } catch (err) { console.error('onMoonIndex error:', err); }
          } else if (typeof onMoon === 'function') {
            try { onMoon(); } catch (err) { console.error('onMoon error:', err); }
          }
        }
      })));
      segments.push({ label: planetLabel, onClick: onPlanet, dropdownItems: planetDropdown });

      if (moonIndex !== null && moonIndex !== undefined) {
        const moon = planet?.moons?.[moonIndex];
        const moonLabel = moon?.name || `Луна ${Number(moonIndex) + 1}`;
        segments.push({ label: moonLabel, onClick: onMoon });
      }
    }
  }

  function render(segs) {
    container.innerHTML = '';
    closeDropdown();
    segs.forEach((seg, idx) => {
      const isLast = idx === segs.length - 1;
      container.appendChild(createSegment(seg.label, seg.onClick, isLast, seg.dropdownItems));
      if (!isLast) container.appendChild(createSeparator());
    });
  }

  function getSpeedPanelRect() {
    const sp = document.getElementById('sim-speed-panel');
    return sp ? sp.getBoundingClientRect() : null;
  }

  function isCollidingWithSpeedPanel() {
    const bc = container.getBoundingClientRect();
    const sp = getSpeedPanelRect();
    if (!sp) return false;
    const marginX = 10;
    const marginY = 8;
    const horiz = (bc.right + marginX) > sp.left && (bc.left) < (sp.right + marginX);
    const vert = (bc.bottom + marginY) > sp.top && (bc.top) < (sp.bottom + marginY);
    return horiz && vert;
  }

  function adjustProgressively() {
    let cur = segments.map(seg => ({ ...seg }));
    render(cur);
    if (!isCollidingWithSpeedPanel()) return;
    const order = [0, 1, 2];
    for (const idx of order) {
      if (idx >= cur.length) continue;
      cur[idx] = { ...cur[idx], label: '...' };
      render(cur);
      if (!isCollidingWithSpeedPanel()) break;
    }
  }

  render(segments);

  container._lastArgs = { star, planetIndex, moonIndex, onGalaxy, onStar, onPlanet, onMoon, onPlanetIndex, onMoonIndex };

  if (!resizeHandlerAttached) {
    window.addEventListener('resize', () => {
      const a = container._lastArgs || {};
      updateBreadcrumbs(a);
    });
    resizeHandlerAttached = true;
  }

  try {
    requestAnimationFrame(() => {
      adjustProgressively();
    });
  } catch (_) {}
}