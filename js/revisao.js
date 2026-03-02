import { escapeHtml, escapeAttr } from "./ui.js";
import { getQuestionById } from "./db.js";

export async function renderErros(db, els, erros){
  if(!erros.length){ els.listErros.innerHTML=`<div class="item"><div class="d">Sem erros ainda.</div></div>`; return; }
  let html="";
  for(const e of erros.slice(0,120)){
    const q=await getQuestionById(db,e.id); if(!q) continue;
    const fund=Array.isArray(q.fundamentacao_legal)?q.fundamentacao_legal.join(" • "):(q.fundamentacao_legal||"—");
    const query=encodeURIComponent(`${q.disciplina||"OAB"} ${q.tema||""} ${fund}`.trim());
    const video=q.video_reforco||`https://www.youtube.com/results?search_query=${query}`;
    html += `<div class="item"><div class="t">${escapeHtml(q.disciplina||"—")} • ${escapeHtml(q.tema||"—")} • <span class="mono" style="font-size:11px;color:var(--muted)">${new Date(e.ts).toLocaleString()}</span></div>
      <div class="d">${escapeHtml((q.enunciado_original||"").slice(0,190))}${(q.enunciado_original||"").length>190?"…":""}</div>
      <div class="d"><b>Lei:</b> ${escapeHtml(fund)} • <b>Marcou:</b> ${escapeHtml(e.chosen||"?")} • <a href="${escapeAttr(video)}" target="_blank" rel="noopener">Vídeo</a></div></div>`;
  }
  els.listErros.innerHTML=html;
}
