import { escapeHtml } from "./ui.js";
import { updAgg, errRate, accRate, avgMs } from "./statsEngine.js";
import { getAllQuestions, getCardById } from "./db.js";

function bar(pct){
  const p=Math.max(0,Math.min(100,Math.round(pct)));
  return `<div class="bar"><div style="width:${p}%"></div></div>`;
}

export async function computeAndRender(db, els){
  const qs=await getAllQuestions(db);
  const aggDisc={}, aggTema={}, aggSub={};
  let resp=0, cor=0, msSum=0, msN=0;

  for(const q of qs){
    const c=await getCardById(db,q.id);
    if(!c) continue;
    const hist=c.history||[];
    for(const h of hist.slice(0,20)){
      resp++; if(h.ok) cor++;
      if(h.ms){ msSum += h.ms; msN++; }
      const d=q.disciplina||"Sem disciplina";
      const t=q.tema||"Sem tema";
      const st=q.subtema||"";
      updAgg(aggDisc,d,h.ok,h.ms);
      updAgg(aggTema,`${d}|${t}`,h.ok,h.ms);
      if(st) updAgg(aggSub,`${d}|${t}|${st}`,h.ok,h.ms);
    }
  }

  els.dTotal.textContent=String(qs.length);
  els.dResp.textContent=String(resp);
  els.dAcc.textContent = resp ? `${Math.round((cor/resp)*100)}%` : "0%";
  els.dSpeed.textContent = msN ? `${Math.round(msSum/msN/1000)}s` : "—";

  const discEntries=Object.entries(aggDisc).sort((a,b)=>b[1].r-a[1].r);
  els.heatDisc.innerHTML = discEntries.length ? discEntries.map(([k,v])=>{
    const a=Math.round(accRate(v)*100);
    const e=Math.round(errRate(v)*100);
    const tm=v.nms?Math.round(v.ms/v.nms/1000):0;
    return `<div class="item"><div class="t">${escapeHtml(k)} <span class="badge">Resp: ${v.r}</span></div><div class="d">Acerto: ${a}% • Erro: ${e}% • Tempo: ${tm}s</div>${bar(a)}</div>`;
  }).join("") : `<div class="item"><div class="d">Sem dados ainda.</div></div>`;

  const temaEntries=Object.entries(aggTema).filter(([_,v])=>v.r>=6);
  const worst=temaEntries.slice().sort((a,b)=>errRate(b[1])-errRate(a[1])).slice(0,12);
  els.worstTema.innerHTML = worst.length ? worst.map(([k,v])=>{
    const [d,t]=k.split("|");
    const e=Math.round(errRate(v)*100);
    return `<div class="item"><div class="t">${escapeHtml(t)} <span class="badge">${escapeHtml(d)}</span></div><div class="d">Erro: ${e}% • Resp: ${v.r}</div></div>`;
  }).join("") : `<div class="item"><div class="d">Sem temas com volume suficiente (>=6).</div></div>`;

  const subEntries=Object.entries(aggSub).filter(([_,v])=>v.r>=5);
  const worstS=subEntries.slice().sort((a,b)=>errRate(b[1])-errRate(a[1])).slice(0,12);
  els.worstSub.innerHTML = worstS.length ? worstS.map(([k,v])=>{
    const parts=k.split("|"); const d=parts[0], t=parts[1], st=parts.slice(2).join("|");
    const e=Math.round(errRate(v)*100);
    return `<div class="item"><div class="t">${escapeHtml(st)} <span class="badge">${escapeHtml(d)} • ${escapeHtml(t)}</span></div><div class="d">Erro: ${e}% • Resp: ${v.r}</div></div>`;
  }).join("") : `<div class="item"><div class="d">Sem subtemas com volume suficiente (>=5).</div></div>`;

  const slow=temaEntries.slice().sort((a,b)=> (avgMs(b[1])||0) - (avgMs(a[1])||0) ).slice(0,12);
  els.slowTema.innerHTML = slow.length ? slow.map(([k,v])=>{
    const [d,t]=k.split("|"); const s=Math.round((avgMs(v)||0)/1000);
    return `<div class="item"><div class="t">${escapeHtml(t)} <span class="badge">${escapeHtml(d)}</span></div><div class="d">Tempo médio: ${s}s • Resp: ${v.r}</div></div>`;
  }).join("") : `<div class="item"><div class="d">Sem dados de tempo ainda.</div></div>`;
}
