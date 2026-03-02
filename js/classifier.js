export function reclassificar(questions){
  return (questions||[]).map(q=>({
    ...q,
    disciplina: q.disciplina || "Sem disciplina",
    tema: q.tema || "Sem tema",
    subtema: q.subtema || ""
  }));
}
