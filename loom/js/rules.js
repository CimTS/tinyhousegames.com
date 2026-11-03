import { neighbors } from "./board.js";
export function canMerge(cells, from, to) {
  if (from === to || !cells[from] || !cells[to]) return false;
  const a=cells[from], b=cells[to];
  return a.c===b.c && a.t===b.t && a.t<3 && neighbors(from).includes(to);
}
export function hasLegalMerge(cells) {
  for(let i=0;i<25;i++) for(const j of neighbors(i)) if(j>i && canMerge(cells,i,j)) return true;
  return false;
}
export function isPieceComplete(cells) {
  return cells.every(Boolean) && !hasLegalMerge(cells);
}
