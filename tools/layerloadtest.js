/* layerloadtest: 每一层都必须"真的加载成功"。
   背景: new/mail.js 第 92 行调了一个不存在的 log() -> 整个文件在 eval 时抛错,
   mock.js 只打一行 "load fail mail.js: log is not defined" 就继续跑, 真机上表现为
   反复刷屏的噪音(而且那一层最后一行之后的代码永远不会执行)。
   这个测试把 boot 期间的 console.warn 录下来, 断言没有任何 "load fail"。 */
const logs = [];
const realWarn = console.warn, realLog = console.log;
Object.defineProperty(console, 'warn', {
  configurable: true,
  get() { return function (m) { logs.push(String(m)); }; },
  set() { /* 忽略 harness 的静音 */ }
});
const { boot } = require('./_harness.js');
try { boot({}); } finally {
  Object.defineProperty(console, 'warn', { configurable: true, writable: true, value: realWarn });
}
let fails = 0;
function ok(c, m) { (realLog)((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fails++; }

const loadFails = logs.filter(l => /load fail/.test(l));
ok(loadFails.length === 0, '所有层都加载成功 (失败 ' + loadFails.length + ' 个)');
loadFails.forEach(l => (realLog)('    ' + l));

const other = logs.filter(l => /HANDLER-ERR|DISPATCH-ERR|probe:|patch .* failed|SyntaxError|ReferenceError|TypeError/.test(l) && !/load fail/.test(l));
ok(other.length === 0, 'boot 期间没有 handler/patch 异常 (异常 ' + other.length + ' 条)');
other.slice(0, 12).forEach(l => (realLog)('    ' + l));

const S = global.MOCK_SEMANTIC || {};
ok(Object.keys(S).length > 60, 'MOCK_SEMANTIC 里注册了协议 (共 ' + Object.keys(S).length + ' 条)');
ok(!!global.MockServer && !!global.MockServer.handle, 'MockServer 建起来了');
ok(!!global.MockServer.clockEnv, '时间层钩子 MockServer.clockEnv 在');
ok(typeof MOCK_STATE === 'object' && MOCK_STATE !== null, '存档状态 MOCK_STATE 在');

(realLog)(fails === 0 ? 'ALL LAYER-LOAD CHECKS PASSED' : (fails + ' CHECK(S) FAILED'));
process.exit(fails === 0 ? 0 : 1);
