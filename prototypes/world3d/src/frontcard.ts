// بطاقات الجبهة (WM14.5، I-073، I-074): بطاقة اللواء (تكوينه، قوته، أمر اختياري، تسمية) وبطاقة المعركة («ليش نربح/نخسر»).
// العدو بأرقام تقديرية (ضباب الحرب)، وقواتنا بالأرقام الحقيقية.
import { bdeStr, bdeMen, bdeMen0, EQ, BN_AR, KIND_AR, TERR_AR, ARMIES, type Bde, type Front, type Side } from './orbat';
const FLAG = ['🇮🇶', '🇮🇷'];
const POST: Record<string, string> = { hold: 'يمسك الخط', attack: 'يهاجم', reserve: 'احتياط يرتاح', move: 'يتحرك', retreat: 'ينسحب' };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const est = (n: number, mine: boolean) => mine ? String(Math.round(n)) : `~${Math.max(10, Math.round(n / 10) * 10)}`;   // العدو تقديري
const bar = (x: number, col: string) => `<span class="cb"><i style="width:${Math.round(Math.max(0, Math.min(1, x)) * 100)}%;background:${col}"></i></span>`;
/** الأسماء اللي يحطها اللاعب تنحفظ بالجهاز (I-074) */
export function applyNames(W: Front) { let m: Record<string, string> = {}; try { m = JSON.parse(store.get('w3_names') || '{}'); } catch { /* */ } for (const b of W.bdes) { const k = `${b.side}:${b.num}`; if (m[k]) b.name = m[k]; } for (const d of W.divs) { const k = `d${d.side}:${d.num}`; if (m[k]) d.name = m[k]; } }
function saveName(key: string, name: string) { let m: Record<string, string> = {}; try { m = JSON.parse(store.get('w3_names') || '{}'); } catch { /* */ } m[key] = name; store.set('w3_names', JSON.stringify(m)); }
export class FrontCard {
  el: HTMLDivElement; cur: { b?: Bde; s?: number } | null = null; tmr = 0;
  constructor(public W: () => Front, public me: Side = 0, public focus: (x: number, y: number, w: number) => void = () => {}) {
    this.el = document.createElement('div'); this.el.id = 'fcard'; this.el.hidden = true; document.body.appendChild(this.el);
    this.el.addEventListener('click', e => this.click(e));
  }
  close() { this.cur = null; this.el.hidden = true; }
  openB(b: Bde) { this.cur = { b }; this.render(); }
  openS(s: number) { this.cur = { s }; this.render(); }
  tick(now: number) { if (!this.cur || this.el.hidden || now - this.tmr < 600) return; this.tmr = now; if (!(this.el.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT')) this.render(); }
  render() {
    const c = this.cur; if (!c) return; this.el.hidden = false;
    this.el.innerHTML = c.b ? this.bdeHtml(c.b) : this.battleHtml(c.s!);
  }
  bdeHtml(b: Bde) {
    const W = this.W(), mine = b.side === this.me, div = W.divs.find(d => d.id === b.div), sec = W.secs[b.s], str = bdeStr(b);
    const rows = b.bns.map(bn => {
      const eq = bn.eq.map(it => `${EQ[it.id].n} <b>${est(it.n, mine)}</b>${mine ? `/${it.n0}` : ''}`).join('، ');
      return `<tr><td>${BN_AR[bn.t]}</td><td>${eq || '—'}</td><td>${est(bn.men, mine)}${mine ? '' : ''} فرد</td></tr>`;
    }).join('');
    const ord = b.ord ? b.ord.t : 'auto';
    const ob = (k: string, t: string) => `<button data-o="${k}" aria-pressed="${ord === k}">${t}</button>`;
    return `<div class="ch"><b class="fl">${FLAG[b.side]}</b><span class="nm">${b.name}</span>${mine ? '<button data-act="rename" title="سمّيه">✎</button>' : ''}<button data-act="x" aria-label="سد">✕</button></div>
      <div class="sub">${div?.name ?? ''} · ${KIND_AR[b.kind].replace('ال', '')} · <b>${POST[b.mv >= 0 ? 'move' : b.post]}</b>${b.fight ? ' ⚔' : ''} · ${W.place_(b.s)} (${TERR_AR[sec.terr]})</div>
      <div class="kv"><span>القوة</span>${bar(str, str > .66 ? '#52c46a' : str > .4 ? '#e6c040' : '#e0573a')}<em>${mine ? pct(str) : '~' + pct(Math.round(str * 10) / 10)}</em></div>
      <div class="kv"><span>التنظيم</span>${bar(b.org / 100, '#9ad0ff')}<em>${Math.round(b.org)}</em></div>
      <div class="kv"><span>التحصين</span>${bar(b.dug, '#c9a36a')}<em>${pct(b.dug)}</em></div>
      <div class="kv"><span>الخبرة</span>${bar(b.exp, '#d2ab33')}<em>${pct(b.exp)}</em></div>
      <table class="bt"><tr><th>الكتيبة</th><th>المعدات</th><th>الأفراد</th></tr>${rows}</table>
      <div class="sub">المجموع: ${est(bdeMen(b), mine)}${mine ? ` من ${Math.round(bdeMen0(b))}` : ''} فرد${mine ? '' : ' (تقديري — ما عدنا استطلاع فوقه)'}</div>
      ${mine ? `<div class="ord"><span>الأمر:</span>${ob('auto', '🤖 تلقائي')}${ob('attack', '⚔ هاجم')}${ob('hold', '🛡 دافع')}${ob('reserve', '⏸ احتياط')}</div><div class="hint">تلقائي = القيادة تقرر. أي أمر ثاني يبقى لحد ما ترجعه تلقائي.</div>` : ''}`;
  }
  battleHtml(s: number) {
    const W = this.W(), bt = W.battles.get(s) ?? [...W.done].reverse().find(q => q.s === s);
    if (!bt) return `<div class="ch"><span class="nm">${W.place_(s)}</span><button data-act="x">✕</button></div><div class="sub">ما أكو معركة هنا هسه.</div>`;
    const att = bt.att, def = (1 - att) as Side, R = bt.R, live = W.battles.get(s) === bt;
    const why = Object.entries(bt.why).filter(([, v]) => Math.abs(v) > .02).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const wr = why.map(([k, v]) => { const f = Math.exp(v), good = v > 0 ? att : def; return `<div class="wy"><span>${k}</span><span class="wb ${v > 0 ? 'p' : 'n'}"><i style="width:${Math.min(50, Math.abs(v) * 40)}%"></i></span><em>${FLAG[good]} ×${(v > 0 ? f : 1 / f).toFixed(2)}</em></div>`; }).join('');
    const L = bt.loss, ln = (sd: Side) => `${FLAG[sd]} ${Math.round(L[sd].men).toLocaleString('en')} فرد · ${Math.round(L[sd].tank)} دبابة · ${Math.round(L[sd].ifv)} مدرعة`;
    const who = R >= 1.5 ? `${FLAG[att]} المهاجم غالب` : R >= 1 ? `${FLAG[att]} المهاجم متقدم شوي` : R >= .67 ? `${FLAG[def]} المدافع صامد` : `${FLAG[def]} المدافع غالب`;
    const n = (sd: Side) => W.inSec(s, sd).filter(b => b.fight).length;
    return `<div class="ch"><b class="fl">⚔</b><span class="nm">معركة ${W.place_(s)}</span><button data-act="x">✕</button></div>
      <div class="sub">${TERR_AR[W.secs[s].terr]} · ${live ? `${bt.h} ساعة` : 'انتهت: ' + (bt.done === 'break' ? 'اخترق المهاجم' : 'توقف الهجوم')} · ${FLAG[att]} ${ARMIES[att].name} ${ARMIES[att].fem ? 'تهاجم' : 'يهاجم'}${live ? ` بـ ${n(att)} ألوية ضد ${n(def)}` : ''}</div>
      <div class="kv"><span>الكفة</span><span class="cb vs a${att}"><i style="width:${Math.round(R / (1 + R) * 100)}%"></i></span><em>${R.toFixed(2)}</em></div>
      <div class="big">${who}</div>
      <div class="sub"><b>ليش؟</b> كل عامل يضرب القوة (أكبر من 1 = لصالح صاحب العلم):</div>${wr}
      <div class="sub">الخسائر: ${ln(att)}<br>${ln(def)}</div>
      ${live || W.priority[this.me][s] > 1 ? `<div class="ord"><button data-act="prio" aria-pressed="${W.priority[this.me][s] > 1}">🎯 ${W.priority[this.me][s] > 1 ? 'أولوية هجوم هنا (شغّالة)' : 'ركّز هجومنا هنا'}</button></div><div class="hint">القيادة التلقائية تحشد هنا أكثر وتقبل نسبة أقل للهجوم.</div>` : ''}`;
  }
  click(e: Event) {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!t || !this.cur) return;
    const W = this.W(), act = t.dataset.act, o = t.dataset.o;
    if (act === 'x') return this.close();
    if (act === 'prio' && this.cur.s !== undefined) { const p = W.priority[this.me]; p[this.cur.s] = p[this.cur.s] > 1 ? 1 : 3; return this.render(); }
    const b = this.cur.b; if (!b) return;
    if (o) { W.order(b.id, o === 'auto' ? null : { t: o as 'attack' | 'hold' | 'reserve' }); return this.render(); }
    if (act === 'rename') {
      const nm = this.el.querySelector('.nm') as HTMLElement; const inp = document.createElement('input'); inp.value = b.name; inp.maxLength = 40; nm.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); if (v) { W.rename(b.id, v); saveName(`${b.side}:${b.num}`, v); } this.render(); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(); }); inp.addEventListener('blur', done);
    }
  }
}
