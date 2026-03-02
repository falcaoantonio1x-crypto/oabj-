import { escapeHtml } from "./ui.js";
import { getAllQuestions } from "./db.js";

export async function renderMapa(db, els){
  const qs=await getAllQuestions(db);
  const dMap=new Map(), tMap=new Map();
  for(const q of qs){
    const d=q.disciplina||"Sem disciplina";
    const t=q.tema||"Sem tema";
    dMap.set(d,(dMap.get(d)||0)+1);
    tMap.set(`${d}|${t}`,(tMap.get(`${d}|${t}`)||0)+1);
  }
  const disc=Array.from(dMap.entries()).sort((a,b)=>b[1]-a[1]);
  const tema=Array.from(tMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,60);

  els.mapDisc.innerHTML = disc.length ? disc.map(([d,n])=>`<div class="item"><div class="t">${escapeHtml(d)} (${n})</div></div>`).join("") : `<div class="item"><div class="d">Banco vazio.</div></div>`;
  els.mapTema.innerHTML = tema.length ? tema.map(([k,n])=>{const [d,t]=k.split("|"); return `<div class="item"><div class="t">${escapeHtml(t)} <span class="badge">${escapeHtml(d)}</span></div><div class="d">Qtd: ${n}</div></div>`}).join("") : `<div class="item"><div class="d">Banco vazio.</div></div>`;
}
