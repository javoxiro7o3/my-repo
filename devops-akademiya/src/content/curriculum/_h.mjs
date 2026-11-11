// Mualliflik yordamchisi: ixcham yozuvdan to'liq Lesson obyektini yasaydi.
export const L = (id, module, title, summary, minutes, o) => ({
  id, module, title, summary, minutes,
  versions: o.v ?? [], objectives: o.obj, concepts: o.con, depth: o.depth,
  glossary: (o.glo ?? []).map(([term, def]) => ({ term, def })),
  labs: o.labs ?? [], breakfix: o.bf ?? [], quizTopics: o.quiz ?? o.con.slice(0, 6), interview: o.iv ?? [],
  related: o.rel ?? [], tools: o.tools ?? [], premium: !!o.premium, ...(o.note ? { note: o.note } : {})
})
