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
