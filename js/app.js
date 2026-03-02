import { $, setActiveTab, escapeHtml, escapeAttr, fmtSec } from "./ui.js";
import { openDB, getMeta, putMeta, clearAll, countQuestions, countDue, bulkUpsertQuestions, listDisciplines, listThemes, listSubthemes, getQuestionById } from "./db.js";
import { reclassificar } from "./classifier.js";
import { buildSession, gradeAnswer, getQ } from "./simuladoEngine.js";
import { computeAndRender } from "./dashboard.js";
import { renderMapa } from "./mapa.js";
import { renderErros } from "./revisao.js";

const LS_ERR="oab_errors_v4";
function loadErr(){ try{return JSON.parse(localStorage.getItem(LS_ERR)||"[]")}catch{return []} }
function saveErr(v){ localStorage.setItem(LS_ERR, JSON.stringify(v)); }

const state = { db:null, session:null, erros: loadErr(), qStart:0, tick:null };

function tabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const name=btn.dataset.tab;
      setActiveTab(name);
      if(name==="dashboard") await computeAndRender(state.db, {
        dTotal: $("dTotal"), dResp: $("dResp"), dAcc: $("dAcc"), dSpeed: $("dSpeed"),
        heatDisc: $("heatDisc"), worstTema: $("worstTema"), worstSub: $("worstSub"), slowTema: $("slowTema")
      });
      if(name==="mapa") await renderMapa(state.db, {mapDisc:$("mapDisc"), mapTema:$("mapTema")});
      if(name==="revisao") await renderErros(state.db, {listErros:$("listErros")}, state.erros);
    });
  });
}

async function loadFromDataJson(){
  const res = await fetch("./data/questoes.json", { cache:"no-store" });
  if(!res.ok) throw new Error("Não conseguiu baixar data/questoes.json");
  const raw = await res.json();
  const questions = reclassificar(raw);
  await bulkUpsertQuestions(state.db, questions);
  await putMeta(state.db, "bank_version", Date.now());
  return questions.length;
}

async function ensureBank(){
  const n = await countQuestions(state.db);
  if(n>0) return n;
  return await loadFromDataJson();
}

async function rebuildFilters(){
  const disc = await listDisciplines(state.db);
  $("fDisc").innerHTML = `<option value="TODAS">Todas</option>` + disc.map(([d,n])=>`<option value="${escapeHtml(d)}">${escapeHtml(d)} (${n})</option>`).join("");
  $("fDisc").onchange = async ()=> { await rebuildThemes(); };
  await rebuildThemes();
}

async function rebuildThemes(){
  const disc=$("fDisc").value;
  const temas = await listThemes(state.db, disc);
  $("fTema").innerHTML = `<option value="TODOS">Todos</option>` + temas.map(([t,n])=>`<option value="${escapeHtml(t)}">${escapeHtml(t)} (${n})</option>`).join("");
  $("fTema").onchange = async ()=> { await rebuildSubthemes(); };
  await rebuildSubthemes();
}

async function rebuildSubthemes(){
  const disc=$("fDisc").value;
  const tema=$("fTema").value;
  const subs = await listSubthemes(state.db, disc, tema);
  $("fSubtema").innerHTML = `<option value="TODOS">Todos</option>` + subs.map(([t,n])=>`<option value="${escapeHtml(t)}">${escapeHtml(t)} (${n})</option>`).join("");
}

async function updateKPIs(){
  $("kBanco").textContent = String(await countQuestions(state.db));
  $("kDue").textContent = String(await countDue(state.db));
  const total=state.session?.ids?.length || 0;
  const idx=state.session?.idx || 0;
  $("kProg").textContent = `${idx}/${total}`;
  $("kAcertos").textContent = String(state.session?.acertos || 0);
}

function startTimer(){
  if(state.tick) clearInterval(state.tick);
  state.tick=setInterval(()=>{
    if(!state.qStart) return;
    $("kTempo").textContent = fmtSec(Date.now()-state.qStart);
  }, 250);
}

async function renderQuestion(){
  await updateKPIs();
  const box=$("questaoBox");
  const fim=$("fimBox");

  if(!state.session || state.session.idx>=state.session.ids.length){
    box.classList.add("hidden"); fim.classList.remove("hidden");
    const total=state.session?.ids?.length||0;
    const acc=total?Math.round((state.session.acertos/total)*100):0;
    $("fimResumo").textContent = `Tu fechou ${total} questões. Acertos: ${state.session?.acertos||0}. Aproveitamento: ${acc}%.`;
    return;
  }

  fim.classList.add("hidden"); box.classList.remove("hidden");
  const id = state.session.ids[state.session.idx];
  const q = await getQ(state.db, id);
  if(!q){ state.session.idx++; return await renderQuestion(); }

  state.qStart = Date.now(); startTimer();

  const tags=[q.exame||"—", q.disciplina||"—", q.tema||"—", q.subtema||"", q.nivel||"Médio"].filter(Boolean)
    .map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join("");
  const alts=["A","B","C","D"].map(L=>`<button class="alt" data-letter="${L}"><b>${L})</b> ${escapeHtml(q.alternativas?.[L]||"")}</button>`).join("");

  box.innerHTML = `<div class="qmeta">${tags}</div>
    <p class="qtext">${escapeHtml(q.enunciado_original||"")}</p>
    <div class="alts">${alts}</div>
    <div class="hr"></div>
    <div id="feedback" class="note">Responde aí.</div>`;

  box.querySelectorAll(".alt").forEach(btn=>btn.addEventListener("click", ()=>onAnswer(q, btn.dataset.letter)));
}

function youtubeLink(q){
  const law=Array.isArray(q.fundamentacao_legal)?q.fundamentacao_legal.join(" "):(q.fundamentacao_legal||"");
  const query=encodeURIComponent(`${q.disciplina||"OAB"} ${q.tema||""} ${q.subtema||""} ${law}`.trim());
  return `https://www.youtube.com/results?search_query=${query}`;
}

async function onAnswer(q, chosen){
  const correct = chosen === q.gabarito;
  const ms = Date.now() - state.qStart;
  state.qStart = 0; $("kTempo").textContent="0s";

  document.querySelectorAll(".alt").forEach(b=>b.disabled=true);
  document.querySelectorAll(".alt").forEach(b=>{
    const L=b.dataset.letter;
    if(L===q.gabarito) b.classList.add("correct");
    if(L===chosen && !correct) b.classList.add("wrong");
  });

  await gradeAnswer(state.db, {id:q.id, ok:correct, ms});

  if(!correct){
    state.erros.unshift({id:q.id, ts:Date.now(), chosen});
    if(state.erros.length>300) state.erros.length=300;
    saveErr(state.erros);
  }

  const fund = Array.isArray(q.fundamentacao_legal)?q.fundamentacao_legal:(q.fundamentacao_legal?[q.fundamentacao_legal]:[]);
  const video = q.video_reforco || youtubeLink(q);
  const fb=document.getElementById("feedback");

  fb.innerHTML = `${correct
    ? `<span style="color:var(--ok);font-weight:900">Certo.</span>`
    : `<span style="color:var(--bad);font-weight:900">Errado.</span>`}
    <div class="note" style="margin-top:8px"><b>Comentário (por que é isso):</b> ${escapeHtml(q.comentario_tecnico||"Sem comentário técnico ainda.")}</div>
    <div class="note" style="margin-top:8px"><b>Fundamento legal:</b> ${escapeHtml(fund.join(" • ")||"—")}</div>
    <div class="note" style="margin-top:8px"><b>Pegadinha/erro comum:</b> ${escapeHtml(q.erro_comum_aluno||"—")}</div>
    <div class="note" style="margin-top:8px"><b>Exemplo simples:</b> ${escapeHtml(q.exemplo_simples||"—")}</div>
    <div class="note" style="margin-top:10px"><a href="${escapeAttr(video)}" target="_blank" rel="noopener">Vídeo do tema</a></div>
    <div class="note" style="margin-top:8px">Tempo: <b>${Math.round(ms/1000)}s</b></div>`;

  setTimeout(async ()=>{
    state.session.idx++;
    if(correct) state.session.acertos++;
    await updateKPIs();
    await renderQuestion();
  }, 700);
}

function hooks(){
  $("btnComecar").addEventListener("click", async ()=>{
    const disc=$("fDisc").value;
    const tema=$("fTema").value;
    const subtema=$("fSubtema").value;
    const nivel=$("fNivel").value;
    const qtd=Math.max(5, parseInt($("fQtd").value||"10",10));
    const srs=$("fSRS").checked;
    const reforco=$("fReforco").checked;
    state.session = await buildSession(state.db,{disc,tema,subtema,nivel,count:qtd,prioritizeSRS:srs,reforco});
    await renderQuestion();
  });

  $("btnNovo").addEventListener("click", async ()=>{
    state.session=null;
    $("fimBox").classList.add("hidden");
    $("questaoBox").classList.add("hidden");
    await updateKPIs();
    alert("Configura e clica Começar.");
  });

  $("btnZerar").addEventListener("click", async ()=>{
    if(!confirm("Vai zerar progresso (SRS) e erros. Confirma?")) return;
    await clearAll(state.db);
    state.erros=[]; saveErr(state.erros);
    const n=await loadFromDataJson();
    await rebuildFilters();
    state.session=null;
    alert(`Zerado. Banco recarregado: ${n}.`);
    await updateKPIs();
  });

  $("btnReforco").addEventListener("click", async ()=>{
    state.session = await buildSession(state.db,{disc:"TODAS",tema:"TODOS",subtema:"TODOS",nivel:"TODOS",count:12,prioritizeSRS:true,reforco:true});
    await renderQuestion();
  });

  $("btnIrDashboard").addEventListener("click", ()=> document.querySelector('.tab[data-tab="dashboard"]').click());

  $("btnLimparErros").addEventListener("click", ()=>{
    if(!confirm("Limpar erros?")) return;
    state.erros=[]; saveErr(state.erros);
    $("listErros").innerHTML=`<div class="item"><div class="d">Sem erros.</div></div>`;
  });

  $("fileJson").addEventListener("change", async (ev)=>{
    const file=ev.target.files?.[0]; if(!file) return;
    $("taJson").value = await file.text();
  });
  $("btnImportar").addEventListener("click", async ()=>{
    const txt=$("taJson").value.trim(); if(!txt) return alert("Cola o JSON ou escolhe um arquivo.");
    let arr; try{arr=JSON.parse(txt)}catch{return alert("JSON inválido.")};
    const qs = reclassificar(arr);
    await bulkUpsertQuestions(state.db, qs);
    await putMeta(state.db, "bank_version", Date.now());
    await rebuildFilters();
    alert(`Importado: ${qs.length}.`);
    await updateKPIs();
  });
  $("btnExport").addEventListener("click", async ()=>{
    const res = await fetch("./data/questoes.json", { cache:"no-store" });
    const blob = new Blob([await res.text()], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="questoes.json"; a.click();
    URL.revokeObjectURL(url);
  });

  $("btnRebuild").addEventListener("click", async ()=>{
    $("adminStatus").textContent="Recarregando…";
    try{
      const n=await loadFromDataJson();
      await rebuildFilters();
      $("adminStatus").textContent=`OK. Banco recarregado: ${n}.`;
      await updateKPIs();
    }catch(e){
      $("adminStatus").textContent=`Erro: ${e.message||e}`;
    }
  });
  $("btnResetDB").addEventListener("click", async ()=>{
    if(!confirm("Vai apagar o banco no IndexedDB. Confirma?")) return;
    await clearAll(state.db);
    $("adminStatus").textContent="Banco apagado. Recarrega pelo botão “Recarregar”.";
    await updateKPIs();
  });
}

async function boot(){
  tabs();
  state.db = await openDB();
  await ensureBank();
  await rebuildFilters();
  await updateKPIs();
  hooks();
  setActiveTab("simulado");
}
boot();
