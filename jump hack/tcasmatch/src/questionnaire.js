import {dimensions} from './questions.js';

function randomUnit(){
  if(globalThis.crypto?.getRandomValues){const n=new Uint32Array(1);globalThis.crypto.getRandomValues(n);return n[0]/4294967296;}
  return Math.random();
}
export function shuffle(items){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(randomUnit()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function sampleSection(bank,group,total=15){
  const categories=dimensions.filter(d=>d.groupKey===group&&d.questionable!==false);
  const base=Math.floor(total/categories.length),remainder=total%categories.length;
  const extraKeys=new Set(shuffle(categories).slice(0,remainder).map(d=>d.key));
  const picked=[];
  for(const dimension of categories){
    const quota=base+(extraKeys.has(dimension.key)?1:0);
    const pool=bank.filter(q=>q.group===group&&q.dim===dimension.key&&!q.ambiguousCategory);
    if(pool.length<quota)throw new Error(`หมวด ${dimension.label} มีคำถามที่จัดหมวดได้ ${pool.length} ข้อ แต่ต้องสุ่ม ${quota} ข้อ`);
    picked.push(...shuffle(pool).slice(0,quota));
  }
  return shuffle(picked);
}
export function sampleQuestionSet(bank){
  const selected=['big5','riasec','mi'].flatMap(group=>sampleSection(bank,group,15));
  if(selected.length!==45)throw new Error(`จำนวนคำถามสุ่มผิดจากที่กำหนด (${selected.length}/45)`);
  return selected;
}
