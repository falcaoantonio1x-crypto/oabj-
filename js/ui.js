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


const THEME_KEY="oab_theme_pref";
export function initTheme(){
  try{
    const saved = localStorage.getItem(THEME_KEY);
    if(saved==="light") document.documentElement.classList.add("theme-light");
    if(saved==="dark") document.documentElement.classList.add("theme-dark");
  }catch{}
}
export function toggleTheme(){
  const el=document.documentElement;
  const isLight = el.classList.contains("theme-light");
  const isDark = el.classList.contains("theme-dark");
  // cycle: auto -> light -> dark -> auto
  if(!isLight && !isDark){
    el.classList.add("theme-light");
    try{localStorage.setItem(THEME_KEY,"light")}catch{}
    return "light";
  }
  if(isLight){
    el.classList.remove("theme-light");
    el.classList.add("theme-dark");
    try{localStorage.setItem(THEME_KEY,"dark")}catch{}
    return "dark";
  }
  el.classList.remove("theme-dark");
  try{localStorage.removeItem(THEME_KEY)}catch{}
  return "auto";
}
