import { gameConfig } from '../config/gameConfig.js';

export function hexToRgbArray(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1.0];
}

export function generateStarName() {
  const syllables = [
    "an", "ar", "bi", "cor", "del", "el", "far", "gal", "hel", "in",
    "jen", "kel", "lor", "mor", "nel", "or", "pil", "qir", "ral", "sin",
    "tor", "ul", "ven", "wor", "xel", "yor", "zen"
  ];
  const count = Math.floor(Math.random() * 2) + 2;
  let name = "";
  for (let i = 0; i < count; i++) {
    name += syllables[Math.floor(Math.random() * syllables.length)];
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export class ExplorationSystem {
  constructor(stars) {
    this.stars = stars;
  }

  // Calculate system complexity (planets + moons)
  calculateSystemComplexity(star) {
    let complexity = star.planets.planets.length; // Base planets
    
    // Add moons
    star.planets.planets.forEach(planet => {
      complexity += planet.moons.length;
    });
    
    return complexity;
  }
}

// Roman numeral conversion function
function toRoman(num) {
    const romanNumerals = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    let roman = '';
    romanNumerals.forEach(({ value, numeral }) => {
      while (num >= value) {
        roman += numeral;
        num -= value;
      }
    });
    return roman;
}

export { toRoman };

// Greek alphabet for moon names
const greekLetters = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

export { greekLetters };
