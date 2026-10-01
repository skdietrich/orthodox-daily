(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const store = window.OrthodoxStore;
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const titles = {morning:'Morning prayer',jesus:'The Jesus Prayer',evening:'Evening prayer',gratitude:'Thanksgiving', 'before-sleep':'Before sleep'};
  const path = [
    ['jesus','Begin with the name of Jesus. Read the prayer slowly, then remain in quiet prayer.'],
    ['morning','Offer the day to God before turning to its demands.'],
    ['gratitude','Remember one kindness you received. Give thanks for the person who offered it.'],
    ['sick','Remember someone who is suffering. Pray for them by name in the silence.'],
    ['forgiveness','Consider whether there is someone you need to forgive, or someone whose forgiveness you should seek.'],
    ['peace','Remember people affected by conflict, near to you and far away.'],
    ['evening','Look back over the week without keeping score. Give thanks, ask forgiveness, and begin again.']
  ];
  let prayers=[], current=null, pathIndex=null, remaining=180, total=180, deadline=0, running=false, completed=false, lastDay=day(), voices=[], speechQueue=[], speechToken=0, dirty=false, toastTimer, editingIntention=null;
  function notice(message) { if($('#sessionDialog').open) $('#sessionStatus').textContent=message;const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),5000); }
  function safe(fn) { try {return fn();} catch(e) {notice(e.name==='QuotaExceededError'?'Storage is full. Export a backup and free space before saving.':`Could not save or load personal data: ${e.message}`);return false;} }
  function read() {return store.snapshot();}
  function change(fn) {return safe(()=>{store.update(fn);return true;});}
  function navigate(view) {document.dispatchEvent(new CustomEvent('orthodox:navigate',{detail:view}));}
  function renderRules(d) {
    const checked=d.completions[day()]||[];
    const rows=d.rule.map(id=>`<div class="rule-row"><label><input type="checkbox" data-practice="${id}" ${checked.includes(id)?'checked':''}>${escape(titles[id])}</label><button class="text-button" data-session="${id}">Pray ↗</button></div>`).join('')||'<p class="fine-print">Choose a small daily practice below.</p>';
    $('#homeRule').innerHTML=rows;$('#fullRule').innerHTML=rows;
    $('#practiceSummary').textContent=`${d.rule.filter(x=>checked.includes(x)).length} of ${d.rule.length} chosen practices marked today. You can return whenever you’re ready.`;
    $('#ruleChoices').innerHTML=Object.entries(titles).map(([id,title])=>`<label class="choice-row"><input type="checkbox" data-rule-choice="${id}" ${d.rule.includes(id)?'checked':''}>${escape(title)}</label>`).join('');
    const marks=[];
    for(let n=6;n>=0;n--){const date=new Date();date.setDate(date.getDate()-n);const done=(d.completions[day(date)]||[]).length>0;marks.push(`<div class="rhythm-day ${done?'complete':''}" aria-label="${escape(date.toLocaleDateString())}: ${done?'prayer marked':'no prayer marked'}">${escape(date.toLocaleDateString(undefined,{weekday:'short'}))}<i>${done?'✓':'·'}</i></div>`);}
    $('#weeklyRhythm').innerHTML=marks.join('');
  }
  function render() {
    safe(()=>{
      const d=read();const hour=new Date().getHours();
      $('#companionDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
      $('#welcomeTitle').textContent=d.profile.name?`${hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'}, ${d.profile.name}.`:'Make room for prayer.';
      document.body.classList.toggle('large-reading',d.profile.readingSize==='large');
      if(document.activeElement!==$('#profileName')) $('#profileName').value=d.profile.name;
      $('#readingSize').value=d.profile.readingSize;
      $('#connectionState').textContent=navigator.onLine?'On this device':'You’re offline';
      renderRules(d);
      $('#pathProgress').textContent=`${d.path.length} of 7 practices completed. Go at your own pace.`;
      $('#continuePath').textContent=d.path.length===7?'Revisit the first practice':d.path.length?'Continue the next practice':'Begin the first practice';
      const entries=Object.entries(d.reflections).sort(([a],[b])=>b.localeCompare(a));
      $('#reflectionHistory').innerHTML=entries.length?entries.map(([date,r])=>`<button class="history-entry" data-reflection="${date}"><strong>${escape(new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}${r.mood?' · '+escape(r.mood):''}</strong><span>${escape((r.gratitude||r.surrender||r.kindness).slice(0,100))}</span></button>`).join(''):'<p class="fine-print">Your saved reflections will appear here.</p>';
      $('#intentionList').innerHTML=d.intentions.length?d.intentions.map(i=>`<div class="intention-item ${i.done?'done':''}"><label><input type="checkbox" data-intention="${escape(i.id)}" ${i.done?'checked':''}>${escape(i.text)}</label><button class="text-button" data-edit-intention="${escape(i.id)}" aria-label="Edit intention: ${escape(i.text)}">Edit</button><button data-remove-intention="${escape(i.id)}" aria-label="Delete intention: ${escape(i.text)}">×</button></div>`).join(''):'<p class="fine-print">Whom would you like to remember today?</p>';
    });
  }
  function loadReflection(date) {
    safe(()=>{const r=read().reflections[date]||{};$('#reflectionDate').value=date;$('#reflectionMood').value=r.mood||'';$('#gratitudeText').value=r.gratitude||'';$('#surrenderText').value=r.surrender||'';$('#kindnessText').value=r.kindness||'';dirty=false;});
  }
  function stopVoice(){speechToken++;speechQueue=[];if('speechSynthesis' in window) window.speechSynthesis.cancel();$('#speakPrayer').textContent='Read prayer';}
  function closeSession(){running=false;stopVoice();$('#sessionDialog').close();}
  function openSession(id,index=null){
    const prayer=prayers.find(p=>p.id===id);if(!prayer){notice('Prayer content is still loading. Please try again.');return;}
    stopVoice();current=prayer;pathIndex=index;running=false;completed=false;
    remaining=total=Number($('#sessionDuration').value)*60;
    $('#sessionTitle').textContent=prayer.title;$('#sessionOrigin').textContent=prayer.origin;
    $('#sessionGuidance').textContent=index===null?'Read slowly. Let the words become your prayer. You may remain in silence afterward.':`Practice ${index+1} of 7. ${path[index][1]}`;
    $('#sessionPrayer').textContent=prayer.text;$('#sessionStatus').textContent='Begin when you are ready.';$('#sessionStart').textContent='Begin timer';$('#sessionStart').disabled=false;$('#sessionComplete').disabled=false;$('#sessionComplete').textContent='Mark prayer complete';$('#sessionDuration').disabled=false;paintTimer();$('#sessionDialog').showModal();
  }
  function paintTimer(){
    $('#sessionCountdown').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(Math.ceil(remaining%60)).padStart(2,'0')}`;
    $('#sessionProgress').max=total;$('#sessionProgress').value=total-remaining;
  }
  function tick(){
    if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));paintTimer();if(remaining===0){running=false;$('#sessionStart').disabled=true;$('#sessionStatus').textContent='The time you set aside has ended. Stay a little longer, or mark your prayer complete.';}}
    if(day()!==lastDay){lastDay=day();render();if(!dirty) loadReflection(lastDay);}
  }
  function voiceList(){
    if(!('speechSynthesis' in window)){ $('#speakPrayer').disabled=true;$('#speechVoice').innerHTML='<option>Read-aloud unavailable in this browser</option>';return;}
    const selected=$('#speechVoice').value;voices=window.speechSynthesis.getVoices().filter(v=>v.lang.startsWith('en'));
    $('#speechVoice').innerHTML='<option value="">Device default</option>'+voices.map((v,i)=>`<option value="${i}">${escape(v.name)}${v.localService?' · on device':''}</option>`).join('');
    if(selected&&voices[Number(selected)]) $('#speechVoice').value=selected;
  }
  function readAloud(){
    if(!current||!('speechSynthesis' in window)) return;
    stopVoice();const token=speechToken;
    speechQueue=current.text.match(/[^.!?]+[.!?]*/g)||[current.text];
    function next(){if(token!==speechToken)return;const text=speechQueue.shift();if(!text){$('#speakPrayer').textContent='Read again';return;}
      const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=Number($('#speechRate').value);const selected=$('#speechVoice').value;if(selected!==''&&voices[Number(selected)])u.voice=voices[Number(selected)];
      u.onend=next;u.onerror=e=>{if(token===speechToken&&e.error!=='canceled'&&e.error!=='interrupted'){notice('Your device could not read this prayer. Try another voice or read the text.');stopVoice();}};window.speechSynthesis.speak(u);
    }
    $('#speakPrayer').textContent='Reading…';next();
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function init(){
    $('#reflectionDate').value=day();loadReflection(day());render();voiceList();
    window.addEventListener('orthodox:personal-change',()=>{render();if(!dirty)loadReflection($('#reflectionDate').value||day());});
    window.addEventListener('online',render);window.addEventListener('offline',render);
    document.addEventListener('orthodox:ready',e=>{prayers=e.detail.prayers;});
    document.addEventListener('click',e=>{
      const session=e.target.closest('[data-session]');if(session)openSession(session.dataset.session);
      const reflection=e.target.closest('[data-reflection]');if(reflection){if(dirty&&!confirm('Discard the unsaved reflection?'))return;loadReflection(reflection.dataset.reflection);$('#reflectionDate').focus();}
      const edit=e.target.closest('[data-edit-intention]');if(edit)safe(()=>{const item=read().intentions.find(i=>i.id===edit.dataset.editIntention);if(item){editingIntention=item.id;$('#intentionText').value=item.text;$('#intentionForm button[type=submit]').textContent='Save intention';$('#cancelIntentionEdit').hidden=false;$('#intentionText').focus();}});
      const remove=e.target.closest('[data-remove-intention]');if(remove&&confirm('Delete this prayer intention?')) change(d=>{d.intentions=d.intentions.filter(i=>i.id!==remove.dataset.removeIntention);});
    });
    document.addEventListener('change',e=>{
      if(e.target.matches('[data-practice]')){const id=e.target.dataset.practice;change(d=>{const set=new Set(d.completions[day()]||[]);e.target.checked?set.add(id):set.delete(id);d.completions[day()]=[...set];});}
      if(e.target.matches('[data-rule-choice]')){const id=e.target.dataset.ruleChoice;change(d=>{d.rule=e.target.checked?[...d.rule,id]:d.rule.filter(x=>x!==id);});}
      if(e.target.matches('[data-intention]')) change(d=>{const item=d.intentions.find(i=>i.id===e.target.dataset.intention);if(item)item.done=e.target.checked;});
    });
    let loadedDate=day();
    $('#reflectionDate').addEventListener('focus',()=>{loadedDate=$('#reflectionDate').value;});
    $('#reflectionDate').addEventListener('change',()=>{if(!store.dateKey($('#reflectionDate').value))return;if(dirty&&!confirm('Discard the unsaved reflection?')){$('#reflectionDate').value=loadedDate;return;}loadReflection($('#reflectionDate').value);loadedDate=$('#reflectionDate').value;});
    $('#reflectionForm').addEventListener('input',e=>{if(e.target.id!=='reflectionDate')dirty=true;});
    $('#reflectionForm').addEventListener('submit',e=>{e.preventDefault();const date=$('#reflectionDate').value;const entry={mood:$('#reflectionMood').value,gratitude:$('#gratitudeText').value.trim(),surrender:$('#surrenderText').value.trim(),kindness:$('#kindnessText').value.trim()};if(!entry.mood&&!entry.gratitude&&!entry.surrender&&!entry.kindness){notice('Write a reflection or choose how you feel before saving.');return;}if(change(d=>{d.reflections[date]=entry;})){dirty=false;notice('Reflection saved on this device.');}});
    $('#deleteReflection').addEventListener('click',()=>{const date=$('#reflectionDate').value;if(confirm('Delete this reflection?')){if(change(d=>{delete d.reflections[date];})){loadReflection(date);notice('Reflection deleted.');}}});
    $('#intentionForm').addEventListener('submit',e=>{e.preventDefault();const text=$('#intentionText').value.trim();if(!text)return;if(change(d=>{if(editingIntention){const item=d.intentions.find(i=>i.id===editingIntention);if(item)item.text=text;else throw Error('This intention was removed. Cancel editing and add it again.');}else d.intentions.unshift({id:crypto.randomUUID(),text,done:false});})){$('#intentionText').value='';editingIntention=null;$('#intentionForm button[type=submit]').textContent='Add intention';$('#cancelIntentionEdit').hidden=true;notice('Intention saved.');}});
    $('#cancelIntentionEdit').addEventListener('click',()=>{editingIntention=null;$('#intentionText').value='';$('#intentionForm button[type=submit]').textContent='Add intention';$('#cancelIntentionEdit').hidden=true;});
    $('#profileForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#profileName').value.trim();const readingSize=$('#readingSize').value;if(change(d=>{d.profile={name,readingSize};}))notice('Preferences saved on this device.');});
    $('#continuePath').addEventListener('click',()=>safe(()=>{const done=read().path;let i=path.findIndex((_,n)=>!done.includes(n));if(i<0)i=0;openSession(path[i][0],i);}));
    $('#closeSession').addEventListener('click',closeSession);
    $('#sessionDialog').addEventListener('cancel',()=>{running=false;stopVoice();});
    $('#sessionDialog').addEventListener('close',()=>{running=false;stopVoice();});
    $('#sessionDuration').addEventListener('change',()=>{if(!running){remaining=total=Number($('#sessionDuration').value)*60;paintTimer();}});
    $('#sessionStart').addEventListener('click',()=>{if(running){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));running=false;$('#sessionStart').textContent='Resume timer';$('#sessionStatus').textContent='Paused. Return when you’re ready.';}else{deadline=Date.now()+remaining*1000;running=true;$('#sessionDuration').disabled=true;$('#sessionStart').textContent='Pause timer';$('#sessionStatus').textContent='Take this time for prayer.';}paintTimer();});
    $('#sessionComplete').addEventListener('click',()=>{if(!current||completed)return;const id=current.id;if(change(d=>{d.completions[day()]=[...new Set([...(d.completions[day()]||[]),id])];if(pathIndex!==null&&!d.path.includes(pathIndex))d.path.push(pathIndex);})){completed=true;running=false;stopVoice();$('#sessionStart').disabled=true;$('#sessionComplete').disabled=true;$('#sessionComplete').textContent='Prayer marked complete';$('#sessionStatus').textContent='Go in peace. Your prayer has been marked for today.';}});
    $('#speakPrayer').addEventListener('click',readAloud);$('#stopSpeech').addEventListener('click',stopVoice);
    if('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged',voiceList);
    $('#downloadReminder').addEventListener('click',()=>{const value=$('#reminderTime').value;if(!/^\d\d:\d\d$/.test(value)){notice('Choose a reminder time first.');return;}const [h,m]=value.split(':');const when=new Date();when.setHours(+h,+m,0,0);if(when<new Date())when.setDate(when.getDate()+1);const stamp=day(when).replace(/-/g,'')+'T'+h+m+'00';const utc=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');download('orthodox-daily-reminder.ics',['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Orthodox Daily//Prayer reminder//EN','BEGIN:VEVENT','UID:'+crypto.randomUUID()+'@orthodox-daily','DTSTAMP:'+utc,'DTSTART:'+stamp,'DURATION:PT5M','RRULE:FREQ=DAILY','SUMMARY:Time for prayer','DESCRIPTION:Take a quiet moment with Orthodox Daily.','BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M','DESCRIPTION:Time for prayer','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n'),'text/calendar');notice('Import the downloaded event into your calendar.');});
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    document.addEventListener('visibilitychange',tick);setInterval(tick,500);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
