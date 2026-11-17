// سجل الأسلحة (WM9.2، I-063): كل نوع بأرقامه (تقريبية من معلومات عامة [ASSUMPTION]) وجيله.
// بالمراحل الجاية كل دولة تاخذ قائمتها من هنا ونسبة تطورها تغيّر الدقة والمدى (gen).
export type Side = 0 | 1;   // 0 العراق، 1 إيران
export interface AirType { kind: 'air'; name: string; sprite: string; len: number; cruise: number; maxG: number; ceiling: number; gen: number; weapons: string[] }
export interface GroundType { kind: 'ground'; name: string; sprite: string; len: number; speed: number; gun?: string; range: number; armor: number; gen: number }
export interface SamType { kind: 'sam'; name: string; sprite: string; len: number; missile: string; range: number; cold: boolean; elev: number; salvo: number; gen: number }
export interface MslType { name: string; len: number; diam: number; burn: number; acc: number; vmax: number; maxG: number; fuze: number; pk: number; guide: 'radar' | 'ir' | 'arm' | 'gps' | 'ballistic'; eject?: number; drop?: number; color: number }
export const MSL: Record<string, MslType> = {
  '48N6': { name: '48N6 (S-400)', len: 7.5, diam: .52, burn: 11, acc: 175, vmax: 2000, maxG: 30, fuze: 16, pk: .5, guide: 'radar', eject: 33, color: 0xf2f1ec },
  'PAC-3': { name: 'PAC-3', len: 5.2, diam: .26, burn: 7, acc: 230, vmax: 1700, maxG: 60, fuze: 6, pk: .8, guide: 'radar', color: 0xf4f2ea },
  'AIM-54': { name: 'فينكس AIM-54', len: 4, diam: .38, burn: 9, acc: 110, vmax: 1300, maxG: 18, fuze: 12, pk: .5, guide: 'radar', drop: .7, color: 0xf2f2ee },
  'AIM-120': { name: 'AIM-120', len: 3.7, diam: .18, burn: 6, acc: 160, vmax: 1300, maxG: 35, fuze: 9, pk: .65, guide: 'radar', drop: .35, color: 0xf2f2ee },
  'AGM-88': { name: 'HARM AGM-88', len: 4.2, diam: .25, burn: 8, acc: 140, vmax: 1200, maxG: 15, fuze: 10, pk: .7, guide: 'arm', drop: .5, color: 0xeeeeea },
  'FAB-500': { name: 'قنبلة FAB-500', len: 2.4, diam: .45, burn: 0, acc: 0, vmax: 300, maxG: 1, fuze: 0, pk: .45, guide: 'gps', color: 0x4a4c44 },
  'Zolfaghar': { name: 'ذو الفقار', len: 10.3, diam: .68, burn: 26, acc: 0, vmax: 2000, maxG: 0, fuze: 0, pk: 1, guide: 'ballistic', color: 0xe9dcc0 },
  '125mm': { name: 'قذيفة 125 ملم', len: .7, diam: .125, burn: 0, acc: 0, vmax: 1700, maxG: 0, fuze: 0, pk: .75, guide: 'ballistic', color: 0xffd28a },
  '120mm': { name: 'قذيفة 120 ملم', len: .7, diam: .12, burn: 0, acc: 0, vmax: 1650, maxG: 0, fuze: 0, pk: .55, guide: 'ballistic', color: 0xffd28a },
  '122mm': { name: 'صاروخ غراد', len: 2.9, diam: .122, burn: 2, acc: 300, vmax: 690, maxG: 0, fuze: 0, pk: .25, guide: 'ballistic', color: 0xdedbd2 },
};
export const AIR: Record<string, AirType> = {
  f16: { kind: 'air', name: 'F-16', sprite: 'f16', len: 15.1, cruise: 250, maxG: 9, ceiling: 15000, gen: 4, weapons: ['AGM-88', 'AIM-120'] },
  su25: { kind: 'air', name: 'Su-25', sprite: 'su25', len: 15.5, cruise: 210, maxG: 6.5, ceiling: 7000, gen: 3, weapons: ['FAB-500'] },
  f14: { kind: 'air', name: 'F-14', sprite: 'f14', len: 19.1, cruise: 260, maxG: 7.5, ceiling: 15000, gen: 3, weapons: ['AIM-54'] },
};
export const GROUND: Record<string, GroundType> = {
  abrams: { kind: 'ground', name: 'أبرامز M1A1', sprite: 'abrams', len: 9.8, speed: 14, gun: '120mm', range: 3000, armor: .7, gen: 3 },
  t72: { kind: 'ground', name: 'T-72', sprite: 't72', len: 9.5, speed: 12, gun: '125mm', range: 3200, armor: .5, gen: 2 },
  bmp: { kind: 'ground', name: 'BMP', sprite: 'bmp', len: 6.7, speed: 14, range: 0, armor: .2, gen: 2 },
  grad: { kind: 'ground', name: 'راجمة غراد', sprite: 'grad', len: 7.4, speed: 12, range: 20000, armor: .1, gen: 2 },
  truck: { kind: 'ground', name: 'شاحنة إمداد', sprite: 'truck', len: 5.3, speed: 14, range: 0, armor: .05, gen: 1 },
};
export const SAM: Record<string, SamType> = {
  s400: { kind: 'sam', name: 'S-400', sprite: 's400', len: 13.5, missile: '48N6', range: 120000, cold: true, elev: 90, salvo: 2, gen: 4 },
  patriot: { kind: 'sam', name: 'باتريوت', sprite: 'patriot', len: 10.4, missile: 'PAC-3', range: 40000, cold: false, elev: 38, salvo: 2, gen: 4 },
};
