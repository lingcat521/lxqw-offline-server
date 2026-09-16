/* screentest: prove the layout fix with the ENGINE'S OWN sizing function.
 *
 * Symptom on the phone: the UI box was smaller than the 640x1136 design box, so
 * content was cut on the right and buttons (准备) sat ~100px off.
 *
 * index.html ships data-scale-mode="fixedHeight" and GameConfig.fullScreen=false,
 * so Main.updateStageSize() bails out and egret keeps FIXED_HEIGHT: the stage
 * width becomes 1136 * screenAspect, which on a 20:9 phone is ~544 < 640.
 * new/screen.js turns fullScreen on, which makes the game pick FIXED_WIDTH on a
 * tall screen (stage width = the design width 640) and clamp the stage to
 * maxWidth x maxHeight (854 x 1420).
 *
 * The maths below are the client's own calculateStageSize() pulled out of
 * egret.min.js, plus the game's own mode choice from main.min.js.
 */
const fs = require('fs');
const BASE = '/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw';
let fail = 0;
function ok(cond, msg) { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; }

function matchBrace(s, start) {
  let d = 0, k = start;
  while (k < s.length) {
    const c = s[k];
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return k; }
    else if (c === '"' || c === "'") { const q = c; k++; while (k < s.length && s[k] !== q) { if (s[k] === '\\') k++; k++; } }
    k++;
  }
  return -1;
}

/* ---- real engine function ---- */
const egret = fs.readFileSync(BASE + '/apk/assets/game/js/egret.min.js', 'utf8');
const mark = 'calculateStageSize=function(';
const mi = egret.indexOf(mark);
ok(mi > 0, 'found calculateStageSize in the engine');
const bstart = egret.indexOf('{', mi + mark.length - 1);
const bend = matchBrace(egret, bstart);
const impl = egret.slice(egret.indexOf('function(', mi), bend + 1);
const MODE = { NO_SCALE: 'noScale', SHOW_ALL: 'showAll', NO_BORDER: 'noBorder', EXACT_FIT: 'exactFit', FIXED_WIDTH: 'fixedWidth', FIXED_HEIGHT: 'fixedHeight', FIXED_NARROW: 'fixedNarrow', FIXED_WIDE: 'fixedWide' };
const t = { StageScaleMode: MODE, RuntimeType: { WXGAME: 'wxgame', WEB: 'web' }, Capabilities: { runtimeType: 'web' } };
const calculateStageSize = new Function('t', 'return (' + impl + ')')(t);

/* ---- the game's own config (main.min.js) ---- */
const main = fs.readFileSync(BASE + '/apk/assets/game/js/main.min.js', 'utf8');
const cfg = {};
for (const kv of ['maxWidth', 'maxHeight', 'designSizeWidth', 'designSizeHeight']) {
  const m = new RegExp('e\\.' + kv + '=(\\d+)').exec(main);
  cfg[kv] = m ? Number(m[1]) : null;
}
ok(cfg.maxWidth === 854 && cfg.maxHeight === 1420 && cfg.designSizeWidth === 640 && cfg.designSizeHeight === 1136,
   'game config read: max ' + cfg.maxWidth + 'x' + cfg.maxHeight + ', design ' + cfg.designSizeWidth + 'x' + cfg.designSizeHeight);
ok(main.indexOf('e.fullScreen=!1') >= 0, 'the shipped default really is fullScreen = false');
ok(/data-scale-mode="fixedHeight"/.test(fs.readFileSync(BASE + '/apk/assets/game/index.html', 'utf8')), 'index.html really ships data-scale-mode="fixedHeight"');
ok(fs.readFileSync(BASE + '/new/screen.js', 'utf8').indexOf('GameConfig.fullScreen = true') >= 0, 'screen.js turns fullScreen on before the engine boots');

/* ---- the phone: vivo V2230A, density 320 -> 540 CSS px wide ---- */
const viewports = [{ w: 540, h: 1128 }, { w: 540, h: 1160 }, { w: 540, h: 1204 }, { w: 411, h: 867 }];
const scaleRate = cfg.designSizeWidth / cfg.designSizeHeight;
let minDeficit = Infinity, worst = null;
console.log('\n  viewport        shipped(fixedHeight)      with screen.js (game picks the mode)');
for (const v of viewports) {
  const oldSize = calculateStageSize(MODE.FIXED_HEIGHT, v.w, v.h, cfg.designSizeWidth, cfg.designSizeHeight);
  const mode = (v.w / v.h > scaleRate) ? MODE.FIXED_HEIGHT : MODE.FIXED_WIDTH;   /* Main.updateStageSize */
  const raw = calculateStageSize(mode, v.w, v.h, cfg.designSizeWidth, cfg.designSizeHeight);
  const newW = Math.max(cfg.designSizeWidth, Math.min(cfg.maxWidth, raw.stageWidth));
  const newH = Math.max(cfg.designSizeHeight, Math.min(cfg.maxHeight, raw.stageHeight));
  const deficit = cfg.designSizeWidth - oldSize.stageWidth;
  if (deficit < minDeficit) { minDeficit = deficit; worst = v; }
  console.log('  ' + (v.w + 'x' + v.h).padEnd(14) + (oldSize.stageWidth + 'x' + oldSize.stageHeight).padEnd(24) +
    '  ' + mode.padEnd(12) + newW + 'x' + newH + (deficit > 0 ? '   (was ' + deficit + 'px narrower than the design box)' : ''));
}

/* ---- assertions ---- */
const oldMain = calculateStageSize(MODE.FIXED_HEIGHT, 540, 1128, 640, 1136);
ok(oldMain.stageWidth < 640, 'shipped mode gives a stage narrower than the 640 design width (' + oldMain.stageWidth + ')');
ok(Math.abs((640 - oldMain.stageWidth) - 96) <= 4,
   'the shortfall is ~96px - exactly the "准备 button sits ~100px off" report (' + (640 - oldMain.stageWidth) + 'px)');
for (const v of viewports) {
  const mode = (v.w / v.h > scaleRate) ? MODE.FIXED_HEIGHT : MODE.FIXED_WIDTH;
  const raw = calculateStageSize(mode, v.w, v.h, 640, 1136);
  const newW = Math.max(640, Math.min(854, raw.stageWidth));
  const newH = Math.max(1136, Math.min(1420, raw.stageHeight));
  ok(mode === MODE.FIXED_WIDTH && newW === 640, v.w + 'x' + v.h + ': fullScreen picks FIXED_WIDTH and the stage is exactly 640 wide, nothing cropped');
  ok(newH >= 1136 && newH <= 1420, v.w + 'x' + v.h + ': stage height ' + newH + ' stays inside the design box limits');
}
/* the mis-scaling is what the player called "the UI is too small / does not fit" */
ok(minDeficit > 0, 'every tested phone viewport was rendering a too-narrow stage before the fix (worst ' + minDeficit + 'px at ' + worst.w + 'x' + worst.h + ')');

console.log('\n' + (fail ? 'FAILED ' + fail + ' check(s)' : 'ALL CHECKS PASSED'));
process.exit(fail ? 1 : 0);
