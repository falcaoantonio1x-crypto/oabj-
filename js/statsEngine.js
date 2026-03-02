export function updAgg(agg,key,ok,ms){
  const r=agg[key]||{r:0,c:0,ms:0,nms:0}; r.r++; if(ok) r.c++;
  if(ms!=null){ r.ms+=ms; r.nms++; }
  agg[key]=r;
}
export function errRate(v){return v.r? (1-(v.c/v.r)) : 0;}
export function accRate(v){return v.r? (v.c/v.r) : 0;}
export function avgMs(v){return v.nms? (v.ms/v.nms) : null;}
