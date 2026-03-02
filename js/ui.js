export const $=(id)=>document.getElementById(id);
export function setActiveTab(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name));
  ["simulado","dashboard","mapa","revisao","importar","admin"].forEach(n=>{
    const el=document.getElementById(`tab-${n}`); if(el) el.classList.toggle("hidden",n!==name);
  });
}
export function escapeHtml(s){return (s??"").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
export function escapeAttr(s){return escapeHtml(s).replaceAll("\n"," ")}
export function fmtSec(ms){const s=Math.max(0,Math.round(ms/1000));return `${s}s`;}
