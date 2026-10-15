import {dimensions,dimensionByKey,groupLabels} from './questions.js';
import {sampleQuestionSet} from './questionnaire.js';
import {toProfile,rankPrograms,scoreProgram,matchReasons} from './match.js';
import {loadAdmissionCriteria,renderAdmissionCriteria,educationPathways,loadEligibilityForPrograms,MAX_ELIGIBILITY_PROGRAMS} from './mytcas.js';

const app=document.querySelector('#app');
const dialogRoot=document.querySelector('#dialog-root');
const state={page:'home',programs:[],questionBank:[],answers:{},qIndex:0,resultGroup:'all',coursePage:1,filtered:[],resultSource:'explorer',explorerScoreGroup:'all'};
let questions=[];
let eligibilityRun=0;
let eligibilityTimer=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=key=>[...new Set(state.programs.map(x=>x[key]).filter(x=>x!=null&&x!==''))].sort((a,b)=>String(a).localeCompare(String(b),'th'));
const groups=['big5','riasec','mi'];
const groupShort={big5:'Big Five',riasec:'RIASEC',mi:'พหุปัญญา'};
const displayWeight=v=>Number.isFinite(Number(v))?String(Number(v)): '—';
const maxPageSize=20;
function mytcasProgramUrl(program){
 const id=String(program?.programId??'').trim();
 return /^\d{12,14}[A-Za-z]?$/.test(id)?`https://course.mytcas.com/programs/${encodeURIComponent(id)}`:'';
}
function mytcasLink(program,label='เปิด MyTCAS · TCAS70 ↗'){
 const href=mytcasProgramUrl(program);
 return href?`<a class="mytcas-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="เปิดข้อมูลหลักสูตรทางการบน MyTCAS">${esc(label)}</a>`:'';
}

async function boot(){
 try{
  const [res,qres]=await Promise.all([fetch(new URL('../data/programs.json', import.meta.url)),fetch(new URL('../data/question_bank.json', import.meta.url))]);
  if(!res.ok) throw new Error(`โหลดข้อมูลหลักสูตรไม่สำเร็จ (${res.status})`);
  if(!qres.ok) throw new Error(`โหลดคลังคำถามไม่สำเร็จ (${qres.status})`);
  const data=await res.json();
  const bankData=await qres.json();
  if(!Array.isArray(bankData.questions))throw new Error('รูปแบบคลังคำถามไม่ถูกต้อง');
  state.questionBank=bankData.questions;
  questions=sampleQuestionSet(state.questionBank);
  if(!Array.isArray(data)||!data.length)throw new Error('ไฟล์ข้อมูลต้องเป็นรายการหลักสูตรที่ไม่ว่าง');
  const required=['university','campus','faculty','group','field','program','type','programId'];
  const invalidRows=[];
  data.forEach((p,i)=>{const missing=required.filter(k=>p?.[k]==null||p[k]==='');if(!p?.weights||typeof p.weights!=='object')missing.push('weights');else for(const d of dimensions.filter(d=>d.weighted!==false)){const v=p.weights[d.key];if(typeof v!=='number'||!Number.isFinite(v)||v<0)missing.push(d.key);}if(missing.length)invalidRows.push({row:p?.row??i+1,fields:missing});});
  state.quality={total:data.length,unique:new Set(data.map(p=>p.programId).filter(Boolean)).size,invalidRows,missingMajor:data.filter(p=>p.major==null||p.major==='').length,missingMajorId:data.filter(p=>p.majorId==null||p.majorId==='').length};
  state.programs=data;
  render();
 }catch(err){
  app.innerHTML=`<section class="page-wrap"><div class="empty-state">${esc(err.message)}<br><br>กรุณารีเฟรชหน้าเว็บ หรือตรวจสอบไฟล์ข้อมูลหลักสูตร</div></section>`;
 }
}
function setPage(page){
 state.page=page; state.coursePage=1;if(page==='home'&&questions.length&&state.qIndex>=questions.length)state.qIndex=0;
 document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 document.querySelector('.main-nav')?.classList.remove('open');
 const menu=document.querySelector('.menu-toggle'); if(menu) menu.setAttribute('aria-expanded','false');
 render(); window.scrollTo({top:0,behavior:'smooth'});
}
function render(){
 if(!state.programs.length){app.innerHTML='<div class="loading">กำลังเตรียมข้อมูลหลักสูตร…</div>';return;}
 const views={home:homeView,quiz:quizView,review:reviewView,results:resultsView,courses:coursesView,method:methodView};
 app.innerHTML=(views[state.page]||homeView)();
 if(state.page==='courses'){
  mountEligibilityControls();
  refreshCourseResults();
 }
}
function homeView(){return quizView();}
function stepFor(index){return index<15?0:index<30?1:2;}
function quizView(){
 if(state.qIndex>=questions.length)return reviewView();
 const q=questions[state.qIndex],d=dimensionByKey[q.dim],step=stepFor(state.qIndex),answered=state.answers[q.id]!=null;
 const labels=['ไม่ตรงเลย','ค่อนข้างไม่ตรง','ปานกลาง','ค่อนข้างตรง','ตรงมาก'];
 return `<div class="page-wrap"><div class="page-heading"><div><div class="eyebrow">แบบสอบถาม · ${String(state.qIndex+1).padStart(2,'0')} / ${questions.length}</div><h1>แบบสำรวจของคุณ</h1><p></p></div><button class="back-link" data-page="courses">← ดูหลักสูตร</button></div><div class="quiz-layout"><aside class="quiz-rail"><div class="progress-track"><div class="progress-fill" style="width:${state.qIndex/questions.length*100}%"></div></div>${[['big5','01','Big Five · บุคลิกภาพ'],['riasec','02','RIASEC · ความสนใจ'],['mi','03','พหุปัญญา']].map(([key,num,label],i)=>`<div class="rail-step ${step===i?'active':''} ${step>i?'done':''}"><b>${step>i?'✓':num}</b>${label}</div>`).join('')}<div class="privacy-card"><strong>คำตอบเป็นส่วนตัว</strong>คำนวณในเบราว์เซอร์ ไม่บันทึกหรือส่งออก</div></aside><section class="question-panel"><div><span class="question-category">${esc(groupLabels[q.group])} · ${esc(d?.label||'')}</span></div><h2 class="question-title">${esc(q.text)}</h2><div class="scale-caption"><span>ไม่ตรงกับฉัน</span><span>ตรงกับฉันมาก</span></div><div class="rating-scale" role="radiogroup" aria-label="ระดับความเห็นด้วย">${[1,2,3,4,5].map((n)=>`<div class="rating-option"><input type="radio" name="answer" id="rating-${n}" value="${n}" ${state.answers[q.id]===n?'checked':''}><label for="rating-${n}"><strong>${n}</strong><span>${labels[n-1]}</span></label></div>`).join('')}</div><p class="question-source">ที่มา ${esc(q.source)}</p><div class="inline-error" id="quiz-error"></div><div class="quiz-actions"><button class="button button-light" data-action="previous-question" ${state.qIndex===0?'disabled':''}>← ย้อนกลับ</button><button class="button button-dark" data-action="next-question" ${answered?'':'disabled'}>${state.qIndex===questions.length-1?'ทบทวนคำตอบ':'ข้อถัดไป'} <span>→</span></button></div></section></div></div>`;
}
function reviewView(){
 const grouped=groups.map(group=>({group,items:questions.filter(q=>q.group===group)}));
 return `<div class="page-wrap"><div class="page-heading"><div><h1>ทบทวนคำตอบ</h1><p>ย้อนกลับไปเปลี่ยนคำตอบได้ก่อนดูผลสำรวจ</p></div><button class="back-link" data-action="previous-question">← กลับไปแก้คำตอบ</button></div><div class="quiz-layout"><aside class="quiz-rail"><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div><div class="rail-step done"><b>✓</b>Big Five · บุคลิกภาพ</div><div class="rail-step done"><b>✓</b>RIASEC · ความสนใจ</div><div class="rail-step done"><b>✓</b>พหุปัญญา</div></aside><section class="question-panel">${grouped.map(({group,items})=>`<h3 style="font-size:13px;font-weight:500;margin:23px 0 0">${esc(groupLabels[group])}</h3><div class="review-grid">${items.map(q=>`<div class="review-item"><span class="review-rating">${state.answers[q.id]}/5</span><strong>${esc(dimensionByKey[q.dim]?.label)}</strong><small>${esc(q.text)}</small></div>`).join('')}</div>`).join('')}<div class="quiz-actions"><button class="button button-light" data-action="restart-quiz">เริ่มใหม่</button><button class="button button-dark" data-action="show-results">ดูผลสำรวจและหลักสูตร <span>↗</span></button></div></section></div></div>`;
}
function profileCards(){
 const p=toProfile(state.answers,questions);
 return groups.map(group=>{const ds=dimensions.filter(d=>d.groupKey===group&&d.key!=='W_N_Low');return `<article class="profile-card"><h3>${esc(groupLabels[group])}</h3>${ds.map(d=>{const value=p[d.key];return `<div class="profile-line"><span>${esc(d.label)}${d.weighted===false?'<small class="profile-note">แสดงโปรไฟล์เท่านั้น · ไม่มีน้ำหนักใน Excel</small>':''}</span><b>${value==null?'—':`${(value*100).toFixed(0)}%`}</b><div class="profile-bar"><i style="width:${value==null?0:value*100}%"></i></div></div>`}).join('')}</article>`}).join('');
}
function resultCard(item,i){
 const reasons=matchReasons(item.program,toProfile(state.answers,questions),3,state.resultGroup);
 const score=Math.round(item.score);
 return `<article class="rec-card"><div class="rec-rank">MATCH ${String(i+1).padStart(2,'0')} · ${esc(item.program.type||'หลักสูตร')}</div><h3>${esc(item.program.program||'ไม่ระบุชื่อหลักสูตร')}</h3><div class="rec-meta">${esc([item.program.university,item.program.faculty,item.program.field].filter(Boolean).join(' · '))}</div>${mytcasLink(item.program)}<div class="rec-score-row"><span class="rec-score">${score}<small style="font-size:10px">%</small></span><div class="scorebar"><i style="width:${score}%"></i></div></div><div class="score-breakdown">ภาพรวม ${Math.round(item.broadScore)}% · จุดแข็งเด่น ${item.focusScore==null?'ไม่มีข้อมูล':`${Math.round(item.focusScore)}%`}</div><div class="reason-chips">${reasons.map(r=>`<span class="reason-chip ${r.isStrength?'strength-chip':''}">${r.isStrength?'จุดเด่น · ':''}${esc(r.dimension.label)} · น้ำหนัก ${displayWeight(r.weight)}</span>`).join('')}</div><div class="rec-footer"><span>รหัส ${esc(item.program.programId||'—')} · น้ำหนักรวม ${item.totalWeight}</span><button data-action="detail" data-row="${item.program.row}">ดูรายละเอียด ↗</button></div></article>`;
}
function resultsView(){
 const profile=toProfile(state.answers,questions),ranked=rankPrograms(state.programs,profile,state.resultGroup),top=ranked.slice(0,8);
 return `<div class="page-wrap"><div class="page-heading"><div><div class="eyebrow">YOUR FIELD MAP · ผลสำรวจ</div><h1>ภาพรวมที่เปิดทางเลือก</h1><p>ผลจัดอันดับจากคำตอบของคุณเทียบกับค่าน้ำหนักที่มีในข้อมูลหลักสูตร</p></div><button class="back-link" data-action="review-answers">ทบทวนคำตอบ ↗</button></div><div class="results-top"><div><h2>${ranked.length?`พบ ${ranked.length.toLocaleString('th-TH')} รายการที่มีน้ำหนักในหมวดนี้`:'ยังไม่มีข้อมูลน้ำหนักให้จับคู่ในหมวดนี้'}</h2><p>คะแนนสุดท้ายรวมภาพรวม 55% และการตรงกับ 30% มิติที่คุณได้คะแนนสูงสุดอีก 45% ไม่ใช่โอกาสสอบติดหรือคะแนนผ่านเกณฑ์</p></div><span class="score-pill">${state.resultGroup==='all'?'ทุกมิติ':groupShort[state.resultGroup]}</span></div><div class="filter-tabs"><button class="filter-tab ${state.resultGroup==='all'?'active':''}" data-score-group="all">ภาพรวม</button>${groups.map(g=>`<button class="filter-tab ${state.resultGroup===g?'active':''}" data-score-group="${g}">${esc(groupShort[g])}</button>`).join('')}</div><div class="profile-grid">${profileCards()}</div><div class="results-title"><div><h2>หลักสูตรที่น่าลองสำรวจ</h2><p>ให้น้ำหนักกับมิติเด่นของคุณมากขึ้น พร้อมคงคะแนนภาพรวมไว้ประกอบ</p></div><button class="text-link" data-action="to-ranked-list">เปิดรายการทั้งหมด ↗</button></div>${top.length?`<div class="rec-list">${top.map(resultCard).join('')}</div>`:'<div class="empty-state">ไม่พบค่าน้ำหนักสำหรับองค์ประกอบที่ตอบ ลองดูหมวดอื่นหรือสำรวจหลักสูตรทั้งหมด</div>'}<div class="result-disclaimer"><strong>อ่านผลอย่างระมัดระวัง:</strong> ค่าน้ำหนักในไฟล์ Excel เป็นตัวเลขจากชุดข้อมูล ไม่ได้ให้สูตรหรือเกณฑ์แปลผลทางจิตวิทยา เว็บไซต์จึงใช้เป็นเพียงตัวบ่งชี้สำหรับสำรวจความสอดคล้อง และไม่สรุปว่าหลักสูตรใดเหมาะหรือไม่เหมาะกับคุณ</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 72px"><button class="button button-dark" data-action="restart-quiz">ทำแบบสำรวจใหม่ <span>↻</span></button><button class="button button-light" data-page="courses">ค้นหาหลักสูตรอื่น</button><button class="button button-light" data-page="method">อ่านวิธีการคำนวณ</button></div></div>`;
}
function coursesView(){
 const completed=Object.keys(state.answers).length===questions.length;
 return `<div class="page-wrap"><div class="page-heading"><div><div class="eyebrow">สำรวจหลักสูตร</div><h1>${completed?'หลักสูตรแนะนำจากแบบสำรวจ':'เปิดแผนที่หลักสูตร'}</h1><p>${completed?'เรียงตามดัชนีจับคู่จากคะแนนของคุณ · ไม่ใช่โอกาสสอบติด · ':'ค้นหาหลักสูตรจากข้อมูลที่แนบ · '}<a class="mytcas-link mytcas-directory-link" href="https://course.mytcas.com/universities" target="_blank" rel="noopener noreferrer">ประกาศ TCAS70 จาก MyTCAS ↗</a></p></div>${completed?'<button class="button button-light" data-page="results">ดูสรุปผลเพิ่มเติม <span>↗</span></button>':'<button class="button button-dark" data-action="start-quiz">ทำแบบสำรวจ <span>↗</span></button>'}</div><section class="explorer-controls" aria-label="ตัวกรองหลักสูตร"><div class="control"><label for="filter-search">ค้นหาชื่อหลักสูตร มหาวิทยาลัย สาขา หรือรหัส</label><input id="filter-search" type="search" placeholder="พิมพ์คำค้น…"></div><div class="control"><label for="filter-uni">มหาวิทยาลัย</label><div class="filter-input-row"><input id="filter-uni" list="universities" placeholder="ทุกมหาวิทยาลัย"><button type="button" class="filter-clear" data-clear-filter="filter-uni" aria-label="ล้างมหาวิทยาลัย" hidden>×</button></div><datalist id="universities">${uniq('university').map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div><div class="control"><label for="filter-faculty">คณะ</label><div class="filter-input-row"><input id="filter-faculty" list="faculties" placeholder="ทุกคณะ"><button type="button" class="filter-clear" data-clear-filter="filter-faculty" aria-label="ล้างคณะ" hidden>×</button></div><datalist id="faculties">${uniq('faculty').map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div><div class="control"><label for="filter-type">ประเภทหลักสูตร</label><div class="filter-input-row"><input id="filter-type" list="types" placeholder="ทุกประเภท"><button type="button" class="filter-clear" data-clear-filter="filter-type" aria-label="ล้างประเภทหลักสูตร" hidden>×</button></div><datalist id="types">${uniq('type').map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div><div class="control"><label for="filter-comp">องค์ประกอบที่มีน้ำหนัก</label><select id="filter-comp"><option value="">ทุกองค์ประกอบ</option>${dimensions.filter(d=>d.weighted!==false).map(d=>`<option value="${d.key}">${esc(d.label)}</option>`).join('')}</select></div><div class="control"><label for="filter-weight-min">น้ำหนักตั้งแต่</label><select id="filter-weight-min"><option value="0">มากกว่า 0</option><option value="1">ตั้งแต่ 1</option><option value="1.5">ตั้งแต่ 1.5</option></select></div><div class="control"><label for="filter-weight-max">น้ำหนักไม่เกิน</label><select id="filter-weight-max"><option value="">ไม่จำกัด</option><option value="1">ไม่เกิน 1</option><option value="1.5">ไม่เกิน 1.5</option></select></div><div class="control"><label for="filter-sort">เรียงตาม</label><select id="filter-sort"><option value="name" ${completed?'':'selected'}>ชื่อหลักสูตร ก–ฮ</option><option value="uni">มหาวิทยาลัย ก–ฮ</option>${completed?'<option value="score" selected>ดัชนีเปรียบเทียบ สูง–ต่ำ</option>':''}</select></div></section><div class="list-toolbar"><span id="list-count">กำลังกรองข้อมูล…</span><span>แสดงหน้าละ ${maxPageSize} รายการ</span><button type="button" class="reset-filters" data-action="reset-course-filters">ล้างตัวกรองทั้งหมด</button></div><div class="course-list" id="course-results"></div><div class="pagination" id="pagination"></div><details class="source-note"><summary>ข้อมูลและข้อจำกัด</summary><div class="source-note-content"><p>${state.quality.invalidRows.length===0?`รหัสและน้ำหนักครบ ${state.quality.total.toLocaleString('th-TH')} แถว`:`พบ ${state.quality.invalidRows.length} แถวที่ข้อมูลจำเป็นไม่ครบ — Excel row ${state.quality.invalidRows.slice(0,10).map(x=>x.row).join(', ')}${state.quality.invalidRows.length>10?'…':''}`} · ${state.quality.unique.toLocaleString('th-TH')} รหัสหลักสูตรไม่ซ้ำ</p><p>ข้อมูลที่ว่าง: วิชาเอก ${state.quality.missingMajor.toLocaleString('th-TH')} แถว · รหัสวิชาเอก ${state.quality.missingMajorId.toLocaleString('th-TH')} แถว; เก็บทุกแถวตามต้นฉบับและควรตรวจประกาศทางการก่อนใช้ตัดสินใจ</p></div></details></div>`;
}
function getFiltered(){
 const search=(document.querySelector('#filter-search')?.value||'').trim().toLocaleLowerCase('th');
 const uni=(document.querySelector('#filter-uni')?.value||'').trim().toLocaleLowerCase('th');
 const faculty=(document.querySelector('#filter-faculty')?.value||'').trim().toLocaleLowerCase('th');
 const type=(document.querySelector('#filter-type')?.value||'').trim().toLocaleLowerCase('th');
 const comp=document.querySelector('#filter-comp')?.value||'';
 const min=Number(document.querySelector('#filter-weight-min')?.value||0);
 const maxRaw=document.querySelector('#filter-weight-max')?.value||'';
 const max=maxRaw===''?Infinity:Number(maxRaw);
 const inWeightRange=value=>Number.isFinite(Number(value))&&Number(value)>0&&Number(value)>=min&&Number(value)<=max;
 const sort=document.querySelector('#filter-sort')?.value||'name';
 let arr=state.programs.filter(p=>{
  if(search&&!`${p.university||''} ${p.campus||''} ${p.faculty||''} ${p.field||''} ${p.program||''} ${p.programId||''} ${p.major||''}`.toLocaleLowerCase('th').includes(search))return false;
  if(uni&&!String(p.university||'').toLocaleLowerCase('th').includes(uni))return false;
  if(faculty&&!String(p.faculty||'').toLocaleLowerCase('th').includes(faculty))return false;
  if(type&&!String(p.type||'').toLocaleLowerCase('th').includes(type))return false;
  if(comp&&!inWeightRange(Number(p.weights?.[comp])))return false;
  if(!comp&&!dimensions.some(d=>inWeightRange(Number(p.weights?.[d.key]))))return false;
  return true;
});
 if(sort==='uni')arr.sort((a,b)=>String(a.university||'').localeCompare(String(b.university||''),'th')||String(a.program||'').localeCompare(String(b.program||''),'th'));
 else if(sort==='score'&&Object.keys(state.answers).length===questions.length){const profile=toProfile(state.answers,questions);arr.sort((a,b)=>(scoreProgram(b,profile,state.explorerScoreGroup).score??-1)-(scoreProgram(a,profile,state.explorerScoreGroup).score??-1));}
 else arr.sort((a,b)=>String(a.program||'').localeCompare(String(b.program||''),'th'));
 return arr;
}
function mountEligibilityControls(){
 const controls=app.querySelector('.explorer-controls');if(!controls)return;
 const control=document.createElement('div');
 control.className='control control-eligibility';
 control.innerHTML=`<label for="filter-education">วุฒิ/เส้นทางการศึกษา</label><select id="filter-education"><option value="">ไม่กรองวุฒิ</option>${educationPathways.map(path=>`<option value="${esc(path.id)}">${esc(path.label)}</option>`).join('')}</select>`;
 const before=controls.querySelector('#filter-comp')?.closest('.control');
 controls.insertBefore(control,before||null);
 const notice=document.createElement('div');
 notice.className='eligibility-status';
 notice.dataset.eligibilityStatus='';
 notice.dataset.tone='info';
 notice.setAttribute('aria-live','polite');
 notice.hidden=true;
 controls.after(notice);
}
function setEligibilityStatus(message,tone='info'){
 const notice=app.querySelector('[data-eligibility-status]');if(!notice)return;
 notice.textContent=message;
 notice.dataset.tone=tone;
 notice.hidden=!message;
}
function renderCourseMessage(message,countMessage){
 const results=app.querySelector('#course-results');
 const count=app.querySelector('#list-count');
 const pagination=app.querySelector('#pagination');
 if(results)results.innerHTML=`<div class="empty-state">${esc(message)}</div>`;
 if(count)count.textContent=countMessage;
 if(pagination)pagination.innerHTML='';
}
function renderCourseRows(arr){
 const results=app.querySelector('#course-results');if(!results)return;
 const total=arr.length,pages=Math.max(1,Math.ceil(total/maxPageSize));state.coursePage=Math.min(state.coursePage,pages);
 const start=(state.coursePage-1)*maxPageSize,shown=arr.slice(start,start+maxPageSize),profile=Object.keys(state.answers).length===questions.length?toProfile(state.answers,questions):null;
 const count=app.querySelector('#list-count');if(count)count.textContent=`พบ ${total.toLocaleString('th-TH')} รายการ · หน้า ${state.coursePage} จาก ${pages}`;
 const selectedPath=educationPathways.find(path=>path.id===app.querySelector('#filter-education')?.value);
 const eligibilityChip=selectedPath?`<span class="eligibility-chip">MyTCAS ระบุรับ ${esc(selectedPath.label)} · อย่างน้อยหนึ่งโครงการ</span>`:'';
 results.innerHTML=shown.length?shown.map(p=>{
  const relevance=profile?scoreProgram(p,profile,state.explorerScoreGroup):null;
  const wkeys=dimensions.map(d=>({d,w:Number(p.weights?.[d.key])||0})).filter(x=>x.w>0).sort((a,b)=>b.w-a.w).slice(0,3);
  return `<article class="course-row"><div><h3>${esc(p.program||'ไม่ระบุชื่อหลักสูตร')}</h3><div class="rec-meta">${esc([p.university,p.faculty,p.field,p.type].filter(Boolean).join(' · '))} · รหัส ${esc(p.programId||'—')}</div>${mytcasLink(p)}${eligibilityChip}<div class="weight-preview">${wkeys.map(({d,w})=>`<span class="reason-chip">${esc(d.label)} · ${w}</span>`).join('')}</div></div><div class="course-score">${relevance?.score!=null?`<strong>${Math.round(relevance.score)}%</strong><span>ดัชนีสำรวจ</span>`:`<strong>—</strong><span>ทำแบบสำรวจเพื่อดูดัชนี</span>`}<button class="detail-link" data-action="detail" data-row="${p.row}">ดูองค์ประกอบ ↗</button></div></article>`;
 }).join(''):'<div class="empty-state">ไม่พบหลักสูตรที่ตรงกับตัวกรองนี้ ลองแก้คำค้นหรือเลือกตัวกรองอื่น</div>';
 const pagination=app.querySelector('#pagination');if(pagination)pagination.innerHTML=pages>1?`<button data-page-num="${state.coursePage-1}" ${state.coursePage===1?'disabled':''}>← ก่อนหน้า</button><span>หน้า ${state.coursePage} / ${pages}</span><button data-page-num="${state.coursePage+1}" ${state.coursePage===pages?'disabled':''}>ถัดไป →</button>`:'';
}
function refreshCourseResults(){
 clearTimeout(eligibilityTimer);eligibilityTimer=0;
 const results=app.querySelector('#course-results');if(!results)return;
 const runId=++eligibilityRun,base=getFiltered(),pathId=app.querySelector('#filter-education')?.value||'';
 if(!pathId){setEligibilityStatus('');renderCourseRows(base);return;}
 const narrowed=['#filter-search','#filter-uni','#filter-faculty','#filter-type'].some(selector=>String(app.querySelector(selector)?.value||'').trim());
 if(!narrowed){
  setEligibilityStatus(`เลือกวุฒิแล้ว · จำกัดผลด้วยคำค้น มหาวิทยาลัย คณะ หรือประเภทหลักสูตรก่อน ระบบตรวจข้อมูลสดได้ไม่เกิน ${MAX_ELIGIBILITY_PROGRAMS} รหัสหลักสูตรต่อครั้ง`,'warning');
  renderCourseMessage('พิมพ์คำค้นหรือเลือกมหาวิทยาลัย/คณะ/ประเภทก่อนใช้ตัวกรองวุฒิ เพื่อค้นข้อมูล MyTCAS สดเฉพาะรายการที่เกี่ยวข้อง',`กรุณาจำกัดผลค้นหาไม่เกิน ${MAX_ELIGIBILITY_PROGRAMS} รหัสหลักสูตร`);return;
 }
 const ids=new Set(base.map(program=>String(program?.programId??'').trim()).filter(id=>/^\d{12,14}[A-Za-z]?$/.test(id)));
 const unlinkedRows=base.filter(program=>!/^\d{12,14}[A-Za-z]?$/.test(String(program?.programId??'').trim())).length;
 const pathway=educationPathways.find(item=>item.id===pathId);
 if(ids.size>MAX_ELIGIBILITY_PROGRAMS){
  setEligibilityStatus(`ผลค้นหามี ${ids.size.toLocaleString('th-TH')} รหัสหลักสูตร · เพิ่มคำค้นหรือเลือกมหาวิทยาลัย/คณะให้เหลือไม่เกิน ${MAX_ELIGIBILITY_PROGRAMS} รหัสก่อนตรวจ MyTCAS สด`,'warning');
  renderCourseMessage('ผลค้นหากว้างเกินไปสำหรับการตรวจข้อมูลสด กรุณาเพิ่มคำค้นหรือระบุสถาบัน/คณะให้แคบลง',`จำกัดผลค้นหาให้เหลือไม่เกิน ${MAX_ELIGIBILITY_PROGRAMS} รหัสหลักสูตร`);return;
 }
 if(!ids.size||!pathway){setEligibilityStatus('');renderCourseMessage('ไม่พบรหัสหลักสูตรที่เชื่อมกับข้อมูล MyTCAS ในผลค้นหานี้','ไม่มีรายการที่ตรวจได้');return;}
 const count=app.querySelector('#list-count');
 setEligibilityStatus(`กำลังตรวจคุณสมบัติ ${pathway.label} จากข้อมูล MyTCAS สด · 0/${ids.size} รหัส`,'loading');
 results.innerHTML='<div class="empty-state">กำลังตรวจคุณสมบัติจาก MyTCAS…</div>';
 if(count)count.textContent=`กำลังตรวจข้อมูลสด 0/${ids.size} รหัสหลักสูตร`;
 loadEligibilityForPrograms(base,pathId,progress=>{
  if(runId!==eligibilityRun)return;
  setEligibilityStatus(`กำลังตรวจคุณสมบัติ ${pathway.label} จากข้อมูล MyTCAS สด · ${progress.completed}/${progress.total} รหัส`,'loading');
  if(count)count.textContent=`กำลังตรวจข้อมูลสด ${progress.completed}/${progress.total} รหัสหลักสูตร`;
 }).then(result=>{
  if(runId!==eligibilityRun||!results.isConnected)return;
  if(result.status!=='ready'){setEligibilityStatus('ตรวจข้อมูลคุณสมบัติไม่สำเร็จ กรุณาลองใหม่','error');renderCourseMessage('ไม่สามารถตรวจข้อมูลคุณสมบัติในขณะนี้ กรุณาลองใหม่หรือตรวจประกาศจาก MyTCAS','ตรวจไม่สำเร็จ');return;}
  const matches=base.filter(program=>result.acceptedIds.has(String(program?.programId??'').trim()));
  const unavailable=result.unknownIds.size,failed=result.failedIds.size;
  const unknownNote=unavailable?` · ${unavailable} รหัสไม่มีข้อมูลคุณสมบัติครบ จึงยืนยันไม่ได้`:'';
  const failedNote=failed?` · ${failed} รหัสดึงข้อมูลไม่สำเร็จ`:'';
  const unlinkedNote=unlinkedRows?` · ${unlinkedRows} แถวไม่มีรหัส MyTCAS ที่ใช้ตรวจได้`:'';
  const summary=`MyTCAS สด · พบ ${result.acceptedIds.size} รหัสที่มีอย่างน้อยหนึ่งโครงการระบุรับ ${pathway.label} · ระบุไม่รับ ${result.rejectedIds.size} รหัส${unknownNote}${failedNote}${unlinkedNote} · ข้อมูลไม่พบ/โหลดไม่สำเร็จไม่ถือว่า “ไม่รับ”`;
  setEligibilityStatus(summary,unavailable||failed||unlinkedRows?'warning':'success');
  if(matches.length)renderCourseRows(matches);
  else renderCourseMessage(`ไม่พบรายการที่ MyTCAS ระบุว่ารับ ${pathway.label}${unavailable||failed?' · มีบางรหัสที่ยังยืนยันไม่ได้เพราะข้อมูลหายหรือโหลดไม่สำเร็จ':''}`,`พบ 0 รายการที่ยืนยันว่ารับ · ไม่รับ ${result.rejectedIds.size} รหัส`);
 }).catch(()=>{
  if(runId!==eligibilityRun||!results.isConnected)return;
  setEligibilityStatus('ดึงข้อมูลคุณสมบัติจาก MyTCAS ไม่สำเร็จ กรุณาลองใหม่','error');
  renderCourseMessage('โหลดข้อมูลคุณสมบัติไม่สำเร็จในขณะนี้ กรุณาลองใหม่หรือตรวจประกาศทางการ','ตรวจข้อมูลไม่สำเร็จ');
 });
}
function methodView(){
 const big=dimensions.filter(d=>d.groupKey==='big5'),ria=dimensions.filter(d=>d.groupKey==='riasec'),mi=dimensions.filter(d=>d.groupKey==='mi');
 return `<div class="page-wrap"><div class="page-heading"><div><div class="eyebrow">TRANSPARENT MATCHING · วิธีการคำนวณ</div><h1>ดูที่มา ก่อนเชื่อผล</h1><p>หลักคิดและข้อจำกัดของระบบจับคู่แบบเปิดเผย</p></div><button class="button button-light" data-page="courses">กลับไปสำรวจหลักสูตร</button></div><div class="method-content"><aside class="method-sidebar"><div class="section-no">METHOD NOTE / 01</div><h2 style="font-size:24px;font-weight:500;line-height:1.4">คะแนนนี้ช่วยตั้งคำถาม ไม่ได้เลือกอนาคตแทนคุณ</h2><p>ระบบใช้คำตอบแบบสำรวจตนเองมาประกอบกับองค์ประกอบน้ำหนักที่อยู่ใน Excel เท่านั้น ไม่ได้ทำนายความสำเร็จหรือรับประกันการรับเข้า</p><div class="caution-box">หากผลไม่ตรงกับความรู้สึกของคุณ ให้ใช้เป็นจุดเริ่มต้นสำรวจเพิ่ม ไม่ใช่ข้อสรุปเกี่ยวกับตัวตน</div></aside><div class="method-main"><section><h2>1. แบบสำรวจมีอะไรบ้าง</h2><p>ทุกครั้งที่เริ่ม ระบบสุ่ม 15 ข้อจากแต่ละชีต รวม 45 ข้อ: Big Five สุ่ม 3 ข้อต่อ trait จากคลัง 50 ข้อ, RIASEC สุ่ม 2–3 ข้อต่อ type จาก 36 ข้อ และพหุปัญญาสุ่ม 1–2 ข้อต่อมิติจาก 81 ข้อ ใช้มาตรวัด 1–5 และสุ่มแบบแบ่งชั้นเพื่อให้ครอบคลุมทุกมิติย่อย</p><p>ใช้ถ้อยคำจาก workbook และระบุชีต/แถวไว้ตรวจย้อนกลับ; ข้อพหุปัญญา 2 ข้อที่ไม่มีเครื่องหมายหมวดและ 1 ข้อที่ทำเครื่องหมายสองหมวดจะไม่ถูกสุ่มใช้ ดนตรีและการเคลื่อนไหวแสดงเป็นโปรไฟล์แยก เพราะ Excel หลักสูตรไม่มีค่าน้ำหนักสองด้านนี้ และดนตรีไม่ใช่สิ่งเดียวกับ RIASEC Artistic แบบสำรวจนี้ไม่ใช่เครื่องมือที่ผ่านการตรวจสอบหรือรับรองทางจิตวิทยา</p></section><section><h2>2. การแปลงคำตอบเป็นดัชนี</h2><p>คำตอบระดับ 1–5 หลายข้อในมิติเดียวกันนำมาเฉลี่ย แล้วแปลงเป็นช่วง 0–1 ด้วยสูตร (ค่าเฉลี่ยคำตอบ − 1) ÷ 4; ข้อ Neuroticism สร้าง N+ จากค่าเฉลี่ยโดยตรง และ N− = 1 − N+ เพื่อเทียบกับรหัสทั้งสองในไฟล์</p><div class="formula">คะแนนสุดท้าย = <span>55% × คะแนนภาพรวม + 45% × [ค่าเฉลี่ยถ่วงน้ำหนักของ 30% มิติเด่น × (0.75 + 0.25 × สัดส่วนน้ำหนักที่ครอบคลุมมิติเด่น)]</span></div><p>คะแนนภาพรวมเฉลี่ยโปรไฟล์ผู้ตอบตามน้ำหนักทุกมิติที่มีข้อมูล ส่วนมิติเด่นคือประมาณ 30% อันดับแรกของมิติที่มีน้ำหนักและคำตอบในกลุ่มที่เลือก (ภาพรวม/Big Five/RIASEC/พหุปัญญา) โดยเรียงตามคะแนนโปรไฟล์; มิติที่เสมอกันตรงเส้นแบ่งจะนับรวมทั้งหมด และหากไม่มีมิติใดสูงกว่าค่าเฉลี่ยของกลุ่ม จะไม่สร้างส่วนเน้นจุดเด่น สัดส่วนความครอบคลุมคือน้ำหนักของหลักสูตรในมิติเด่น หารด้วยน้ำหนักรวมของมิติที่มีข้อมูล หากหลักสูตรไม่มีน้ำหนักในมิติเด่น จะใช้คะแนนภาพรวมแทน ค่าน้ำหนัก 0 ไม่ร่วมคำนวณ</p><p>ตัวเลขใน Excel เช่น 0, 1 และ 1.5 ใช้ตามต้นฉบับ ไม่แปลงเป็นร้อยละ และคะแนนนี้เป็นดัชนีเรียงเปรียบเทียบเพื่อสำรวจ ไม่ใช่คะแนนรับเข้า</p></section><section><h2>3. น้ำหนักหลักสูตรบอกอะไร—and ไม่ได้บอกอะไร</h2><p>สูตรใหม่ยังคงคะแนนภาพรวมไว้ 55% แต่เพิ่มส่วนเน้นจุดแข็ง 45% เพื่อให้หลักสูตรที่มีน้ำหนักในมิติที่ผู้ตอบได้คะแนนเด่นมีโอกาสขึ้นมาอย่างเหมาะสมมากขึ้น ป้าย “จุดเด่น” บนเหตุผลจับคู่หมายถึงมิติที่อยู่ใน 30% อันดับสูงสุดของโปรไฟล์ ไม่ใช่การวินิจฉัยหรือการยืนยันความเหมาะสม</p><p>เกณฑ์สอบเข้าจาก MyTCAS แสดงแยกในรายละเอียดหลักสูตร และไม่ถูกรวมกับดัชนีจากแบบสอบถาม</p><div class="caution-box">เอกสาร Excel ไม่ได้ระบุสูตรที่ใช้สร้างน้ำหนัก เกณฑ์ความเหมาะสม คะแนนเต็ม หรือความสัมพันธ์เชิงทิศทางที่ผ่านการตรวจสอบ เว็บไซต์จึงไม่กล่าวอ้างว่าดัชนีสูงหมายถึงเหมาะสมจริงหรือมีโอกาสสอบติดสูงกว่า</div></section><section><h2>4. มิติที่สำรวจ</h2><table class="dimension-table"><thead><tr><th>หมวด</th><th>องค์ประกอบ</th><th>รหัสน้ำหนักในไฟล์</th></tr></thead><tbody>${[...big,...ria,...mi].map(d=>`<tr><td>${esc(groupShort[d.groupKey])}</td><td>${esc(d.label)}<br><small>${esc(d.detail)}</small></td><td>${d.weighted===false?'ไม่มีคอลัมน์ใน Excel':`<code>${esc(d.key)}</code>`}</td></tr>`).join('')}</tbody></table><p>N+ และ N− มาจากค่าเฉลี่ยคำตอบ Neuroticism ชุดเดียวกัน โดย N− กลับทิศจาก N+; ดนตรีและการเคลื่อนไหวไม่มีคอลัมน์น้ำหนักหลักสูตรใน Excel จึงแสดงโปรไฟล์แยกและไม่ส่งผลต่ออันดับหลักสูตร</p></section><section><h2>5. คุณภาพและความเป็นส่วนตัว</h2><p>ข้อมูลหลักสูตรถูกแสดงตามแถวต้นฉบับจากไฟล์ที่ผู้ใช้ให้มา รายการที่มีรหัสหลักสูตรซ้ำอาจเป็นแถวหรือสาขาย่อยต่างกัน ข้อมูลหลักสูตร น้ำหนัก และความทันสมัยควรตรวจสอบกับประกาศทางการของมหาวิทยาลัย/TCAS อีกครั้งก่อนใช้ตัดสินใจ</p><p>คำตอบแบบสอบถามประมวลผลในเบราว์เซอร์ และไม่ถูกส่งหรือบันทึกบนเซิร์ฟเวอร์ เมื่อออกจากหน้าหรือรีเฟรช คำตอบจะไม่ถูกเก็บไว้</p></section></div></div></div>`;
}
function openDetail(rowNumber,group='all'){
 const p=state.programs.find(x=>Number(x.row)===Number(rowNumber));if(!p)return;
 const profile=Object.keys(state.answers).length===questions.length?toProfile(state.answers,questions):null;
 const score=profile?scoreProgram(p,profile,group):null;
 dialogRoot.innerHTML=`<div class="dialog-backdrop" data-action="close-dialog"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="ปิด" data-action="close-dialog">×</button><div class="eyebrow">PROGRAM DETAIL · EXCEL ROW ${esc(p.row)}</div><h2 id="dialog-title">${esc(p.program||'ไม่ระบุชื่อหลักสูตร')}</h2><p style="font-size:11px;color:var(--muted)">${esc(p.university||'ไม่ระบุมหาวิทยาลัย')} · ${esc(p.faculty||'ไม่ระบุคณะ')}</p>${mytcasLink(p,'ดูข้อมูลรับสมัครและรายละเอียดปี 2570 บน MyTCAS ↗')}<section class="admission-criteria" aria-labelledby="admission-title"><div class="admission-heading"><div class="eyebrow">TCAS70 · ADMISSION CRITERIA</div><h3 id="admission-title">รายวิชาที่ใช้ สัดส่วน และคะแนนขั้นต่ำ</h3><p>ข้อมูลจาก MyTCAS ปีการศึกษา 2570 แยกตามรอบและโครงการ · ไม่ใช้คำนวณคะแนนแบบสอบถาม</p></div><div class="criteria-state" data-admission-criteria aria-live="polite">กำลังโหลดเกณฑ์จาก MyTCAS…</div><p class="criteria-source">ตรวจประกาศล่าสุดได้ที่ลิงก์ MyTCAS ด้านบน</p></section><div class="detail-rows">${[['วิทยาเขต',p.campus],['กลุ่มสาขา',p.group],['สาขาวิชา',p.field],['ประเภทหลักสูตร',p.type],['รหัสหลักสูตร',p.programId],['วิชาเอก',p.major],['รหัสวิชาเอก',p.majorId],...(score?.score!=null?[['หมวดคะแนนที่ใช้',group==='all'?'ทุกมิติ':groupShort[group]],['คะแนนภาพรวม',`${Math.round(score.broadScore)}%`],['คะแนนมิติเด่น',score.focusScore==null?'ไม่มีมิติเด่น/น้ำหนัก':`${Math.round(score.focusScore)}%`],['ดัชนีสำรวจของคุณ',`${Math.round(score.score)}%`],['น้ำหนักรวมในสูตร',score.totalWeight]]:[])].map(([label,val])=>`<div class="detail-data"><small>${esc(label)}</small><strong>${esc(val??'ไม่มีข้อมูลในไฟล์')}</strong></div>`).join('')}</div><h3 style="font-size:14px;font-weight:500;margin:20px 0 8px">องค์ประกอบคะแนน/น้ำหนักในแถวข้อมูลนี้</h3><table class="weight-table"><thead><tr><th>หมวด</th><th>องค์ประกอบ</th><th>รหัส</th><th>น้ำหนัก</th></tr></thead><tbody>${dimensions.map(d=>{const value=p.weights?.[d.key];return `<tr><td>${esc(groupShort[d.groupKey])}</td><td>${esc(d.label)}</td><td>${d.weighted===false?'ไม่มีคอลัมน์ใน Excel':`<code>${esc(d.key)}</code>`}</td><td class="${Number(value)===0?'weight-zero':'weight-value'}">${d.weighted===false?'ไม่มีคอลัมน์ใน Excel':displayWeight(value)}</td></tr>`}).join('')}</tbody></table><p class="question-source">ค่าทั้งหมดคงตาม Excel ต้นฉบับ · แถวข้อมูล ${esc(p.row)}</p></section></div>`;
}
function resetQuiz(){if(!state.questionBank.length)return;questions=sampleQuestionSet(state.questionBank);state.answers={};state.qIndex=0;state.resultGroup='all';state.explorerScoreGroup='all';setPage('home');}

// Delegated UI events
app.addEventListener('click',e=>{
 const clearFilter=e.target.closest('[data-clear-filter]');
 if(clearFilter){const input=document.getElementById(clearFilter.dataset.clearFilter);if(input){input.value='';clearFilter.hidden=true;state.coursePage=1;refreshCourseResults();input.focus();}return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 const page=e.target.closest('[data-page]')?.dataset.page;
 const scoreGroup=e.target.closest('[data-score-group]')?.dataset.scoreGroup;
 const pageNum=e.target.closest('[data-page-num]')?.dataset.pageNum;
 if(page){setPage(page);return;}
 if(scoreGroup){state.resultGroup=scoreGroup;state.explorerScoreGroup=scoreGroup;render();return;}
 if(pageNum){state.coursePage=Number(pageNum);refreshCourseResults();document.querySelector('#course-results')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
	if(action==='start-quiz'){resetQuiz();return;}
	if(action==='reset-course-filters'){
	  const defaults={'filter-search':'','filter-uni':'','filter-faculty':'','filter-type':'','filter-education':'','filter-comp':'','filter-weight-min':'0','filter-weight-max':'','filter-sort':Object.keys(state.answers).length===questions.length?'score':'name'};
	  for(const [id,value] of Object.entries(defaults)){const control=document.getElementById(id);if(control)control.value=value;}
	  document.querySelectorAll('[data-clear-filter]').forEach(button=>button.hidden=true);
  state.explorerScoreGroup='all';state.coursePage=1;refreshCourseResults();return;
 }
 if(action==='next-question'){
  const checked=app.querySelector('input[name="answer"]:checked');if(!checked){const err=document.querySelector('#quiz-error');if(err)err.textContent='เลือกคำตอบหนึ่งข้อก่อนดำเนินการต่อ';return;}
  state.answers[questions[state.qIndex].id]=Number(checked.value);state.qIndex++;
  if(state.qIndex===questions.length){state.resultGroup='all';state.explorerScoreGroup='all';state.coursePage=1;state.page='courses';render();return;}render();return;
 }
 if(action==='previous-question'){
  if(state.page==='review')state.qIndex=questions.length-1;else state.qIndex=Math.max(0,state.qIndex-1);
  state.page='home';render();return;
 }
 if(action==='show-results'){
  const missing=questions.find(q=>state.answers[q.id]==null);if(missing){state.qIndex=questions.indexOf(missing);state.page='home';render();return;}
  state.resultGroup='all';state.page='results';render();return;
 }
 if(action==='review-answers'){state.page='review';render();return;}
 if(action==='restart-quiz'){resetQuiz();return;}
 if(action==='to-ranked-list'){state.resultSource='results';state.explorerScoreGroup=state.resultGroup;setPage('courses');const sort=document.querySelector('#filter-sort');if(sort&&[...sort.options].some(o=>o.value==='score'))sort.value='score';refreshCourseResults();return;}
 if(action==='detail'){
  const row=e.target.closest('[data-row]')?.dataset.row;
  const group=state.page==='courses'?state.explorerScoreGroup:state.resultGroup;
  openDetail(row,group);
  const program=state.programs.find(x=>Number(x.row)===Number(row));
  const target=dialogRoot.querySelector('[data-admission-criteria]');
  if(program&&target){
   if(!mytcasProgramUrl(program))target.innerHTML='<p class="criteria-missing">ไม่มีรหัสหลักสูตรที่เชื่อมกับข้อมูลเกณฑ์ MyTCAS</p>';
   else loadAdmissionCriteria(program.programId).then(criteria=>{if(target.isConnected)target.innerHTML=renderAdmissionCriteria(criteria);}).catch(()=>{if(target.isConnected)target.innerHTML='<p class="criteria-state criteria-error">โหลดเกณฑ์จาก MyTCAS ไม่สำเร็จในขณะนี้ กรุณาลองใหม่หรือตรวจจากลิงก์ทางการด้านบน</p>';});
  }
  return;
 }
 if(action==='close-dialog'&&(e.target.classList.contains('dialog-backdrop')||e.target.closest('.dialog-close'))){dialogRoot.innerHTML='';return;}
 if(action==='cancel-quiz'){if(Object.keys(state.answers).length){state.page='review';render();}else setPage('home');return;}
});
dialogRoot.addEventListener('click',e=>{if(e.target.closest('[data-action="close-dialog"]')&&(e.target.classList.contains('dialog-backdrop')||e.target.closest('.dialog-close')))dialogRoot.innerHTML='';});

app.addEventListener('change',e=>{
	if(e.target.matches('input[name="answer"]')){
	  state.answers[questions[state.qIndex].id]=Number(e.target.value);
	  const btn=document.querySelector('[data-action="next-question"]');if(btn)btn.disabled=false;
	  const err=document.querySelector('#quiz-error');if(err)err.textContent='';
	 }
	 if(e.target.matches('#filter-uni,#filter-faculty,#filter-type,#filter-comp,#filter-weight-min,#filter-weight-max,#filter-sort,#filter-education')){state.coursePage=1;refreshCourseResults();}
	});
app.addEventListener('input',e=>{if(e.target.matches('#filter-search,#filter-uni,#filter-faculty,#filter-type')){const clear=document.querySelector(`[data-clear-filter="${e.target.id}"]`);if(clear)clear.hidden=!e.target.value;state.coursePage=1;if(app.querySelector('#filter-education')?.value){clearTimeout(eligibilityTimer);eligibilityTimer=setTimeout(()=>refreshCourseResults(),350);}else refreshCourseResults();}});
document.querySelectorAll('.site-header [data-page],.footer-method').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.page)));
document.querySelectorAll('.site-header [data-action="start-quiz"]').forEach(el=>el.addEventListener('click',resetQuiz));
document.querySelector('.menu-toggle')?.addEventListener('click',e=>{const nav=document.querySelector('.main-nav'),open=nav.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialogRoot.innerHTML)dialogRoot.innerHTML='';});
boot();
