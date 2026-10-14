const MYTCAS_DATA = 'https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas';
const ROUND_NAMES = {1:'Portfolio',2:'Quota',3:'Admission',4:'Direct Admission'};
const MAX_CONCURRENT_FETCHES = 6;
export const MAX_ELIGIBILITY_PROGRAMS = 100;
export const educationPathways = [
 {id:'formal',field:'only_formal',label:'Formal · หลักสูตรแกนกลาง'},
 {id:'international',field:'only_international',label:'International · หลักสูตรนานาชาติ'},
 {id:'vocational',field:'only_vocational',label:'Vocational · หลักสูตรอาชีวะ'},
 {id:'nonformal',field:'only_non_formal',label:'Non-formal · หลักสูตรตามอัธยาศัย (กศน.)'},
 {id:'ged',field:'only_ged',label:'GED · หลักสูตร GED'}
];
const requestCache = new Map();
const fetchQueue = [];
let activeFetches = 0;
let subjectMapPromise;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const formatNumber = value => new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(Number(value));
const validProgramId = value => /^\d{12,14}[A-Za-z]?$/.test(String(value ?? '').trim());

function fetchLimited(url,options){
 return new Promise((resolve,reject)=>{
  const run=()=>{
   activeFetches++;
   Promise.resolve().then(()=>fetch(url,options)).then(resolve,reject).finally(()=>{
    activeFetches--;
    fetchQueue.shift()?.();
   });
  };
  if(activeFetches<MAX_CONCURRENT_FETCHES)run();
  else fetchQueue.push(run);
 });
}

function eligibilityStatus(value){
 if(value===1||value==='1')return 'accepted';
 if(value===2||value==='2')return 'rejected';
 return 'unknown';
}

async function getSubjectMap(){
 if(!subjectMapPromise){
  subjectMapPromise=fetch(new URL('../data/mytcas_score_subjects.json', import.meta.url))
   .then(response=>response.ok?response.json():[])
   .then(rows=>new Map((Array.isArray(rows)?rows:[]).filter(row=>row?.key).map(row=>[String(row.key),row])))
   .catch(()=>new Map());
 }
 return subjectMapPromise;
}

export function subjectLabel(code,subjects){
 const key=String(code??'').replace(/^min_/,'').replace(/_pr$/,'');
 const item=subjects.get(key);
 return item?.label || `รหัสวิชา ${key.replaceAll('_',' ')}`;
}

export async function loadAdmissionCriteria(programId){
 const id=String(programId??'').trim();
 if(!validProgramId(id)) throw new Error('รหัสหลักสูตรไม่ถูกต้อง');
 if(requestCache.has(id)) return requestCache.get(id);
 const request=(async()=>{
  const [response,subjects]=await Promise.all([
   fetchLimited(`${MYTCAS_DATA}/rounds/${encodeURIComponent(id)}.json?ts=${Date.now().toString(16)}`,{cache:'no-store'}),
   getSubjectMap()
  ]);
  if(!response.ok) throw new Error(`MyTCAS ${response.status}`);
  const data=await response.json();
  if(!Array.isArray(data)) throw new Error('รูปแบบเกณฑ์ MyTCAS ไม่ถูกต้อง');
  return {projects:data,subjects};
 })();
 requestCache.set(id,request);
 request.catch(()=>{if(requestCache.get(id)===request)requestCache.delete(id);});
 return request;
}

export async function loadEligibilityForPrograms(programs,pathwayId,onProgress=()=>{}){
 const pathway=educationPathways.find(item=>item.id===pathwayId);
 if(!pathway)return {status:'invalid',acceptedIds:new Set(),rejectedIds:new Set(),unknownIds:new Set(),failedIds:new Set(),total:0,completed:0};
 const allIds=[...new Set((Array.isArray(programs)?programs:[]).map(program=>String(program?.programId??'').trim()).filter(Boolean))];
 const ids=allIds.filter(validProgramId);
 if(ids.length>MAX_ELIGIBILITY_PROGRAMS)return {status:'too-many',acceptedIds:new Set(),rejectedIds:new Set(),unknownIds:new Set(),failedIds:new Set(),total:ids.length,completed:0};
 const acceptedIds=new Set(),rejectedIds=new Set(),unknownIds=new Set(),failedIds=new Set();
 let nextIndex=0,completed=0;
 const worker=async()=>{
  while(true){
   const index=nextIndex++;
   if(index>=ids.length)return;
   const id=ids[index];
   try{
    const {projects}=await loadAdmissionCriteria(id);
    const statuses=(Array.isArray(projects)?projects:[]).map(project=>eligibilityStatus(project?.[pathway.field]));
    if(statuses.includes('accepted'))acceptedIds.add(id);
    else if(statuses.length&&statuses.every(status=>status==='rejected'))rejectedIds.add(id);
    else unknownIds.add(id);
   }catch{
    failedIds.add(id);
   }
   completed++;
   try{onProgress({completed,total:ids.length});}catch{}
  }
 };
 await Promise.all(Array.from({length:Math.min(MAX_CONCURRENT_FETCHES,ids.length)},()=>worker()));
 return {status:'ready',acceptedIds,rejectedIds,unknownIds,failedIds,total:ids.length,completed};
}

function weightRows(project,subjects){
 const scores=project?.scores;
 if(!scores||typeof scores!=='object')return [];
 const rows=[];
 for(const [key,value] of Object.entries(scores)){
  if(['cal_type','cal_score_sum','cal_subject_name'].includes(key))continue;
  const amount=numeric(value);
  if(amount===null||amount===0)continue;
  rows.push({label:subjectLabel(key,subjects),value:amount});
 }
 const combined=numeric(scores.cal_score_sum);
 if(combined!==null&&combined!==0){
  const groups=String(scores.cal_subject_name??'').split('|').map(group=>group.trim().split(/\s+/).filter(Boolean));
  const label=groups.filter(group=>group.length).map(group=>{
   const labels=group.map(code=>subjectLabel(code,subjects));
   return labels.length>1?`ผลรวมของ ${labels.join(' + ')}`:labels[0];
  }).join(' หรือ ') || 'ผลรวมคะแนนตามเกณฑ์ MyTCAS';
  rows.push({label,value:combined});
 }
 return rows;
}

function minimumRows(project,subjects){
 const conditions=project?.score_conditions&&typeof project.score_conditions==='object'?project.score_conditions:{};
 const rows=[];
 const gpax=numeric(conditions.min_gpax??project?.min_gpax);
 if(gpax!==null&&gpax>0)rows.push(esc(`GPAX ต่ำสุด ${formatNumber(gpax)}`));
 for(const [key,value] of Object.entries(conditions)){
  if(!key.startsWith('min_')||key==='min_gpax')continue;
  const amount=numeric(value);
  if(amount===null||amount<=0)continue;
  const percentile=key.endsWith('_pr');
  const code=key.slice(4);
  rows.push(esc(`${percentile?'คะแนน Percentile ขั้นต่ำของ':'คะแนนขั้นต่ำวิชา'} ${subjectLabel(code,subjects)} ${formatNumber(amount)}`));
 }
 const total=numeric(project?.min_total_score??conditions.min_total_score);
 if(total!==null&&total>0)rows.push(`คะแนนรวมขั้นต่ำ ${formatNumber(total)}`);

 const codes=String(conditions.subject_names??'').trim().split(/\s+/).filter(Boolean);
 const minimums=String(conditions.score_minimum??'').trim().split(/\s+/).filter(Boolean);
 const condition=Number(conditions.score_condition);
 if(codes.length&&(condition===1||condition===2)){
  const labels=codes.map(code=>esc(subjectLabel(code,subjects)));
  if(condition===1){
   if(minimums.length===1)rows.push(`คะแนนขั้นต่ำของวิชาใดวิชาหนึ่งระหว่าง ${labels.join(', ')} คือ ${esc(minimums[0])}`);
   else{
    const pairs=codes.map((code,index)=>`${esc(subjectLabel(code,subjects))}${minimums[index]?` ≥ ${esc(minimums[index])}`:''}`);
    rows.push(`คะแนนขั้นต่ำของวิชาใดวิชาหนึ่งระหว่าง ${pairs.join(' · ')}`);
   }
  }
  if(condition===2)rows.push(`คะแนนขั้นต่ำของผลรวม ${labels.join(' + ')}${minimums.length?` คือ ${esc(minimums.join(' / '))}`:''}`);
 }
 return rows;
}

function eligibilityRows(project){
 return educationPathways.map(pathway=>{
  const status=eligibilityStatus(project?.[pathway.field]);
  const text=status==='accepted'?'รับ':status==='rejected'?'ไม่รับ':'ไม่มีข้อมูลใน MyTCAS';
  const symbol=status==='accepted'?'✓':status==='rejected'?'×':'—';
  return `<li class="qualification-${status}"><span class="qualification-icon" aria-hidden="true">${symbol}</span><span class="qualification-label">${esc(pathway.label)}</span><strong class="qualification-status">${text}</strong></li>`;
 }).join('');
}

function projectHtml(project,subjects,index){
 const weights=weightRows(project,subjects);
 const minimums=minimumRows(project,subjects);
 const name=project.project_name_th&&project.project_name_th!=='0'?project.project_name_th:`โครงการ ${project.project_id??'ไม่ระบุชื่อ'}`;
 const weightContent=weights.length
  ?`<div class="criteria-table-wrap"><table class="criteria-table"><thead><tr><th>วิชาหรือองค์ประกอบ</th><th>สัดส่วน</th></tr></thead><tbody>${weights.map(row=>`<tr><td>${esc(row.label)}</td><td>${formatNumber(row.value)}%</td></tr>`).join('')}</tbody></table></div>`
  :'<p class="criteria-missing">MyTCAS ยังไม่แสดงสัดส่วนการคำนวณคะแนนสำหรับโครงการนี้</p>';
 const minimumContent=minimums.length
  ?`<ul class="criteria-minimum-list">${minimums.map(row=>`<li>${row}</li>`).join('')}</ul>`
  :'<p class="criteria-missing">MyTCAS ยังไม่แสดงคะแนนขั้นต่ำรายวิชาหรือ GPAX สำหรับโครงการนี้</p>';
 return `<details class="criteria-project" ${index===0?'open':''}><summary><span>${esc(name)}</span></summary><div class="criteria-project-content"><section class="criteria-eligibility" aria-label="คุณสมบัติเส้นทางการศึกษา"><h5>คุณสมบัติผู้สมัครตามเส้นทางการศึกษา</h5><ul class="qualification-list">${eligibilityRows(project)}</ul><p class="criteria-eligibility-note">สถานะอ้างอิงจากข้อมูลโครงการใน MyTCAS; หากไม่มีฟิลด์หรือไม่ระบุค่า จะแสดงว่าไม่มีข้อมูลและควรตรวจประกาศทางการ</p></section><h5>การคำนวณคะแนน</h5>${weightContent}<h5>คะแนนขั้นต่ำและคุณสมบัติด้านคะแนน</h5>${minimumContent}</div></details>`;
}

export function renderAdmissionCriteria(data){
 const projects=Array.isArray(data?.projects)?data.projects:[];
 const subjects=data?.subjects instanceof Map?data.subjects:new Map();
 if(!projects.length)return '<p class="criteria-missing">ยังไม่พบข้อมูลรอบหรือโครงการจาก MyTCAS สำหรับรหัสหลักสูตรนี้</p>';
 const rounds=new Map();
 for(const project of projects){
  const type=String(project?.type??'');
  const match=type.match(/^([1-4])(?:_(\d{4}))?/);
  const round=match?Number(match[1]):0;
  const year=match?.[2]||'2570';
  const key=`${round}_${year}`;
  if(!rounds.has(key))rounds.set(key,{round,year,projects:[]});
  rounds.get(key).projects.push(project);
 }
 const groups=[...rounds.values()].sort((a,b)=>(a.round||99)-(b.round||99));
 return `<div class="criteria-rounds">${groups.map((group,groupIndex)=>`<details class="criteria-round" ${groupIndex===0?'open':''}><summary><strong>${group.round?`รอบ ${group.round} ${ROUND_NAMES[group.round]}`:'รอบที่ MyTCAS ระบุ'}</strong><span>ปีการศึกษา ${esc(group.year)} · ${group.projects.length} โครงการ</span></summary><div class="criteria-round-content">${group.projects.map((project,index)=>projectHtml(project,subjects,index)).join('')}</div></details>`).join('')}</div><p class="criteria-disclaimer">เกณฑ์แตกต่างตามรอบและโครงการ; ข้อมูลที่ไม่มีใน MyTCAS ไม่ได้ถูกแทนด้วย 0 หรือประมาณค่า โปรดตรวจประกาศจากลิงก์ทางการด้านบนก่อนสมัคร</p>`;
}
