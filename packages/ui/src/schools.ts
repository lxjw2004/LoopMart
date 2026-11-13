export const schools = [
  { id: 'purdue-west-lafayette', name: 'Purdue University - West Lafayette', shortName: 'Purdue' },
];

const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function matchesSchool(school: { name: string }, query: string): boolean {
  const name = normalize(school.name);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.every(term => name.includes(term))) return true;
  // Ordered character matching also accepts abbreviations such as "PUWL".
  const compactName = name.replaceAll(' ', '');
  let position = 0;
  for (const character of terms.join('')) {
    const index = compactName.indexOf(character, position);
    if (index === -1) return false;
    position = index + 1;
  }
  return true;
}
