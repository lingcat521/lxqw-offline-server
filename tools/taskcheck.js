global.window=global;
eval(require('fs').readFileSync('/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/new/activities.js','utf8'));
var t=window.MOCK_SEMANTIC['task_load']();
console.log('tasks', (t.tasks||[]).length, '| list', (t.list||[]).length);
console.log('task[0]', JSON.stringify((t.tasks||[])[0]||{}).slice(0,130));
console.log('prog[0]', JSON.stringify((t.list||[])[0]||{}));
