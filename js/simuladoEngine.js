import { getDueCardIds, getNewCardIds, getQuestionById, getCardById, putCard } from "./db.js";
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function daysToMs(d){return Math.round(d*24*60*60*1000);}

export async function gradeAnswer(db,{id,ok,ms}){
  const now=Date.now();
  const card=await getCardById(db,id);
  if(!card) return;

  const quality = ok ? (ms!=null && ms>45000 ? 4 : 5) : 0;
  let ease = card.ease ?? 2.3;
  let reps = card.reps ?? 0;
  let interval = card.interval ?? 0;

  if(quality < 3){
    reps = 0;
    interval = 1;
    ease = clamp(ease - 0.2, 1.3, 2.7);
  } else {
    ease = clamp(ease + (0.1 - (5-quality)*(0.08 + (5-quality)*0.02)), 1.3, 2.7);
    reps += 1;
    if(reps === 1) interval = 1;
    else if(reps === 2) interval = 3;
    else interval = Math.round(Math.max(1, interval) * ease);
    interval = clamp(interval, 1, 120);
  }

  let avg = card.avgTimeMs || 0;
  avg = avg ? Math.round(avg*0.7 + (ms||0)*0.3) : (ms||0);

  const hist = Array.isArray(card.history) ? card.history.slice() : [];
  hist.unshift({t:now, ok:!!ok, ms:ms||0});
  if(hist.length>80) hist.length=80;

  const nextDue = now + daysToMs(interval);
  await putCard(db, {
    ...card,
    ease, reps, interval,
    due: nextDue,
    lastSeen: now,
    avgTimeMs: avg,
    history: hist,
    subtema: card.subtema || ""
  });
}

export async function buildSession(db,{disc,tema,subtema,nivel,count=10,prioritizeSRS=true,reforco=false}){
  const limit=Math.max(5,Math.min(80,count));
  const due = prioritizeSRS ? await getDueCardIds(db,{disc,tema,subtema,nivel,limit:limit*2}) : [];
  const need = Math.max(0, limit - due.length);
  const news = need>0 ? await getNewCardIds(db,{disc,tema,subtema,nivel,limit:need*2}) : [];
  const ids=[];

  for(const id of due){ if(ids.length>=limit) break; ids.push(id); }

  if(reforco){
    const extra = Array.from(new Set([...due, ...news])).slice(0, 160);
    const scored=[];
    for(const id of extra){
      const c=await getCardById(db,id);
      if(!c) continue;
      const last=(c.history||[]).slice(0,12);
      const err=last.length ? (last.filter(x=>!x.ok).length/last.length) : 0.35;
      const score=(2.8-(c.ease||2.3)) + err*2;
      scored.push({id,score});
    }
    scored.sort((a,b)=>b.score-a.score);
    for(const s of scored){
      if(ids.length>=limit) break;
      if(!ids.includes(s.id)) ids.push(s.id);
    }
  }

  for(const id of news){
    if(ids.length>=limit) break;
    if(!ids.includes(id)) ids.push(id);
  }

  if(ids.length<limit){
    const more = await getDueCardIds(db,{disc,tema,subtema,nivel,limit:limit});
    for(const id of more){
      if(ids.length>=limit) break;
      if(!ids.includes(id)) ids.push(id);
    }
  }

  return { ids, idx:0, acertos:0 };
}

export async function getQ(db,id){
  return await getQuestionById(db,id);
}
