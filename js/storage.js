/* Versioned local repository. No credentials, network writes, or private data in the site bundle. */
(() => {
  'use strict';
  const KEY = 'orthodoxDailyCompanionV2';
  const blank = () => ({version:2,profile:{name:'',readingSize:'normal'},reflections:{},intentions:[],rule:['morning','jesus','evening'],completions:{},path:[]});
  const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const dateKey = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s;
  };
  const str = (s,n) => typeof s === 'string' && s.length <= n;
  const ids = ['morning','jesus','evening','gratitude','before-sleep'];
  function validate(d) {
    if (!record(d) || d.version !== 2 || !record(d.profile) || !str(d.profile.name,40) || !['normal','large'].includes(d.profile.readingSize) || !record(d.reflections) || !record(d.completions) || !Array.isArray(d.intentions) || !Array.isArray(d.rule) || !Array.isArray(d.path)) throw Error('This personal-data backup has an unsupported format.');
    if (Object.keys(d.reflections).length > 20000 || Object.keys(d.completions).length > 20000 || d.intentions.length > 1000 || d.rule.length > 5 || !d.rule.every(x=>ids.includes(x)) || new Set(d.rule).size !== d.rule.length || d.path.length > 7 || !d.path.every(x=>Number.isInteger(x)&&x>=0&&x<7) || new Set(d.path).size !== d.path.length) throw Error('Invalid personal-data limits.');
    for (const [k,v] of Object.entries(d.reflections)) if (!dateKey(k)||!record(v)||!str(v.gratitude,6000)||!str(v.surrender,6000)||!str(v.kindness,3000)||!['','Peaceful','Grateful','Hopeful','Tired','Anxious','Grieving'].includes(v.mood)) throw Error('Invalid reflection in backup.');
    for (const [k,v] of Object.entries(d.completions)) if (!dateKey(k)||!Array.isArray(v)||v.length>100||!v.every(x=>str(x,100))) throw Error('Invalid practice history in backup.');
    for (const v of d.intentions) if (!record(v)||!str(v.id,100)||!str(v.text,180)||typeof v.done!=='boolean') throw Error('Invalid prayer intention in backup.');
    if (new Set(d.intentions.map(x=>x.id)).size !== d.intentions.length) throw Error('Duplicate prayer intention identifiers.');
    return d;
  }
  function snapshot() {
    const raw = localStorage.getItem(KEY);
    return raw ? validate(JSON.parse(raw)) : blank();
  }
  function replace(next) {
    validate(next);
    // A single atomic localStorage write: quota failures cannot partially replace the personal record.
    localStorage.setItem(KEY,JSON.stringify(next));
    window.dispatchEvent(new Event('orthodox:personal-change'));
  }
  function update(fn) { const d = snapshot(); fn(d); replace(d); }
  window.OrthodoxStore = {snapshot,validate,replace,update,dateKey};
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null) window.dispatchEvent(new Event('orthodox:personal-change'));});
})();
