export const readHistory = () => {
  try { return JSON.parse(localStorage.getItem('vortex.history')||'[]'); } catch { return []; }
};
export const saveProgress = (item, progress) => {
  const h = readHistory();
  const idx = h.findIndex(x=>x.id===item.id);
  if(idx>=0) h[idx].progress = progress;
  else h.push({id:item.id, progress, updatedAt:Date.now()});
  localStorage.setItem('vortex.history', JSON.stringify(h.slice(-100)));
};
export const clearProgress = (id) => {
  const h = readHistory().filter(x=>x.id!==id);
  localStorage.setItem('vortex.history', JSON.stringify(h));
};