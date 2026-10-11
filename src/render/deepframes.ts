// How many animation frames a Deepworks chamber machine's sprite has (restored or not): the imported
// sheet (art/deep/build.mjs, `deep:<kind>:<restored>:<frame>`) draws a 4-frame working loop, the
// derelict lamp works' glimmer and the lockers' hanging lamp in 2, the star's twinkle in 4.
export function deepFrames(kind: string, on: boolean): number {
  if (kind === 'star') return 4;
  if (kind === 'lockers') return 2;
  if (kind === 'lampworks') return on ? 4 : 2;
  return on && (kind === 'pump' || kind === 'lift' || kind === 'boiler' || kind === 'cart') ? 4 : 1;
}
