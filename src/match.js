import {dimensions} from './questions.js';

export function toProfile(answers,activeQuestions=[]){
  const profile={};
  for(const d of dimensions){
    if(d.key==='W_N_Low')continue;
    const values=activeQuestions.filter(q=>q.dim===d.key&&answers[q.id]!=null).map(q=>(Number(answers[q.id])-1)/4);
    profile[d.key]=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  }
  const neuroticism=profile.W_N_High;
  profile.W_N_Low=neuroticism==null?null:1-neuroticism;
  return profile;
}

export function strengthDimensions(profile,group='all'){
  const eligible=dimensions.filter(d=>d.weighted!==false&&(group==='all'||d.groupKey===group)&&Number.isFinite(profile[d.key]));
  const count=Math.max(1,Math.ceil(eligible.length*.3));
  if(!eligible.length)return [];
  const mean=eligible.reduce((sum,d)=>sum+profile[d.key],0)/eligible.length;
  const ranked=eligible.sort((a,b)=>profile[b.key]-profile[a.key]||a.key.localeCompare(b.key));
  const cutoff=profile[ranked[Math.min(count,ranked.length)-1].key];
  return ranked.filter(d=>profile[d.key]>=cutoff-1e-9&&profile[d.key]>mean+1e-9);
}

export function scoreProgram(program,profile,group='all'){
  const eligible=dimensions.filter(d=>d.weighted!==false&&(group==='all'||d.groupKey===group));
  const strengths=strengthDimensions(profile,group);
  const strengthKeys=new Set(strengths.map(d=>d.key));
  let weighted=0,totalWeight=0,focusedWeighted=0,focusedWeight=0;
  for(const d of eligible){
    const weight=Number(program.weights?.[d.key]),value=profile[d.key];
    if(Number.isFinite(weight)&&weight>0&&Number.isFinite(value)){
      weighted+=value*weight;totalWeight+=weight;
      if(strengthKeys.has(d.key)){focusedWeighted+=value*weight;focusedWeight+=weight;}
    }
  }
  if(!totalWeight)return {score:null,totalWeight:0,broadScore:null,focusScore:null,focusCoverage:0,focusKeys:[]};
  const broadScore=weighted/totalWeight*100;
  const focusCoverage=focusedWeight/totalWeight;
  const focusMean=focusedWeight?focusedWeighted/focusedWeight:null;
  const focusScore=focusMean==null?null:focusMean*(.75+.25*focusCoverage)*100;
  const score=focusScore==null?broadScore:.55*broadScore+.45*focusScore;
  return {score,totalWeight,broadScore,focusScore,focusCoverage,focusKeys:strengths.map(d=>d.key)};
}

export function rankPrograms(programs,profile,group='all'){
  return programs.map(program=>({program,...scoreProgram(program,profile,group)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score||String(a.program.program).localeCompare(String(b.program.program),'th'));
}

export function matchReasons(program,profile,limit=3,group='all'){
  const focusKeys=new Set(strengthDimensions(profile,group).map(d=>d.key));
  return dimensions.filter(d=>d.weighted!==false&&(group==='all'||d.groupKey===group)).map(d=>({dimension:d,value:profile[d.key],weight:Number(program.weights?.[d.key])||0,contribution:(Number.isFinite(profile[d.key])?profile[d.key]:0)*(Number(program.weights?.[d.key])||0),isStrength:focusKeys.has(d.key)})).filter(x=>x.weight>0&&Number.isFinite(x.value)).sort((a,b)=>Number(b.isStrength)-Number(a.isStrength)||b.contribution-a.contribution).slice(0,limit);
}
