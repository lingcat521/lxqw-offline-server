/* dispracetest: 启动竞态重投。
   真机日志里 04:22 / 17:21 / 22:00 各出现过一次
     DISPATCH-ERR item_load_items : Cannot read properties of null (reading 'getFile')
   —— 登录瞬间我们就把物品数据推给客户端, 而 Egret 的 AssetManager 还没建好。
   异常被 catch 住(不死), 但那一次刷新丢了。现在会识别这类错误并在 400/1200ms 后重投。 */
const H = require('./_harness.js');
const ok = H.ok;

let injected = 0, delivered = 0;
const warns = [];
const realWarn = console.warn;
console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(' ')); };

H.boot({ stubs: function (g) {
  g.core.ServiceDispatcher = { getInstance: function () { return {
    hasEventListener: function () { return true; },
    dispatchEvent: function (ev) {
      if (ev && ev.type === 'item_load_items') {
        if (injected < 1) { injected++; var e = new Error("Cannot read properties of null (reading 'getFile')"); throw e; }
        delivered++;
      }
    }
  }; } };
}});
const M = global.MockServer;
M.dispatch('item_load_items', { house: [{ item_id: 1000, count: 1 }] });
ok(injected === 1, '第一次投递按预期抛了 getFile 竞态错误');
ok(delivered === 0, '第一次确实没送达');
ok(warns.some(w => /资源管理器未就绪/.test(w)), '日志明确标注了"资源管理器未就绪 -> 稍后重投"');

setTimeout(function () {
  ok(delivered >= 1, '重投成功送达 (delivered=' + delivered + ')');
  console.warn = realWarn;
  console.log(H.fails() ? ('\ndispracetest: ' + H.fails() + ' FAILED') : '\ndispracetest: all checks passed');
  process.exit(H.fails() ? 1 : 0);
}, 1600);
