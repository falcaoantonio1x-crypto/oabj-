const DB_NAME="OABDatabase";
const DB_VER=1;
const STORE_Q="questions";
const STORE_C="cards";
const STORE_M="meta";

function reqP(req){return new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);});}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});}

export async function openDB(){
  return await new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VER);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE_Q)){
        const s=db.createObjectStore(STORE_Q,{keyPath:"id"});
        s.createIndex("disciplina","disciplina",{unique:false});
        s.createIndex("tema","tema",{unique:false});
        s.createIndex("subtema","subtema",{unique:false});
        s.createIndex("nivel","nivel",{unique:false});
      }
      if(!db.objectStoreNames.contains(STORE_C)){
        const s=db.createObjectStore(STORE_C,{keyPath:"id"});
        s.createIndex("due","due",{unique:false});
        s.createIndex("disciplina","disciplina",{unique:false});
        s.createIndex("tema","tema",{unique:false});
        s.createIndex("subtema","subtema",{unique:false});
      }
      if(!db.objectStoreNames.contains(STORE_M)){
        db.createObjectStore(STORE_M,{keyPath:"k"});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

export async function getMeta(db,k,def=null){
  const tx=db.transaction(STORE_M,"readonly");
  const r=await reqP(tx.objectStore(STORE_M).get(k));
  return r?.v ?? def;
}
export async function putMeta(db,k,v){
  const tx=db.transaction(STORE_M,"readwrite");
  tx.objectStore(STORE_M).put({k,v});
  await txDone(tx);
}

export async function clearAll(db){
  const tx=db.transaction([STORE_Q,STORE_C,STORE_M],"readwrite");
  tx.objectStore(STORE_Q).clear();
  tx.objectStore(STORE_C).clear();
  tx.objectStore(STORE_M).clear();
  await txDone(tx);
}

export async function countQuestions(db){
  const tx=db.transaction(STORE_Q,"readonly");
  return await reqP(tx.objectStore(STORE_Q).count());
}
export async function countDue(db,now=Date.now()){
  const tx=db.transaction(STORE_C,"readonly");
  const idx=tx.objectStore(STORE_C).index("due");
  let c=0;
  await new Promise((resolve,reject)=>{
    const r=idx.openCursor(IDBKeyRange.upperBound(now));
    r.onsuccess=()=>{const cur=r.result; if(!cur) return resolve(); c++; cur.continue();};
    r.onerror=()=>reject(r.error);
  });
  return c;
}

export async function bulkUpsertQuestions(db,questions){
  const tx=db.transaction(STORE_Q,"readwrite");
  const s=tx.objectStore(STORE_Q);
  for(const q of questions) s.put(q);
  await txDone(tx);

  // ensure cards exist
  const tx2=db.transaction([STORE_Q,STORE_C],"readwrite");
  const qs=tx2.objectStore(STORE_Q);
  const cs=tx2.objectStore(STORE_C);

  await new Promise((resolve,reject)=>{
    const r=qs.openCursor();
    r.onsuccess=()=>{
      const cur=r.result;
      if(!cur) return resolve();
      const q=cur.value;
      const get=cs.get(q.id);
      get.onsuccess=()=>{
        if(!get.result){
          cs.put({
            id:q.id,
            disciplina:q.disciplina||"Sem disciplina",
            tema:q.tema||"Sem tema",
            subtema:q.subtema||"",
            ease:2.3,
            interval:0,
            reps:0,
            due:Date.now(),
            lastSeen:0,
            avgTimeMs:0,
            history:[]
          });
        }
        cur.continue();
      };
      get.onerror=()=>reject(get.error);
    };
    r.onerror=()=>reject(r.error);
  });
  await txDone(tx2);
}

export async function getAllQuestions(db){
  const tx=db.transaction(STORE_Q,"readonly");
  const s=tx.objectStore(STORE_Q);
  const out=[];
  await new Promise((resolve,reject)=>{
    const r=s.openCursor();
    r.onsuccess=()=>{const cur=r.result; if(!cur) return resolve(); out.push(cur.value); cur.continue();};
    r.onerror=()=>reject(r.error);
  });
  return out;
}
export async function getQuestionById(db,id){
  const tx=db.transaction(STORE_Q,"readonly");
  return await reqP(tx.objectStore(STORE_Q).get(id));
}
export async function getCardById(db,id){
  const tx=db.transaction(STORE_C,"readonly");
  return await reqP(tx.objectStore(STORE_C).get(id));
}
export async function putCard(db,card){
  const tx=db.transaction(STORE_C,"readwrite");
  tx.objectStore(STORE_C).put(card);
  await txDone(tx);
}

export async function listDisciplines(db){
  const qs=await getAllQuestions(db);
  const m=new Map();
  for(const q of qs){ const d=q.disciplina||"Sem disciplina"; m.set(d,(m.get(d)||0)+1); }
  return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
}
export async function listThemes(db,disc){
  const qs=await getAllQuestions(db);
  const m=new Map();
  for(const q of qs){
    const d=q.disciplina||"Sem disciplina";
    if(disc && disc!=="TODAS" && d!==disc) continue;
    const t=q.tema||"Sem tema";
    m.set(t,(m.get(t)||0)+1);
  }
  return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
}
export async function listSubthemes(db,disc,tema){
  const qs=await getAllQuestions(db);
  const m=new Map();
  for(const q of qs){
    const d=q.disciplina||"Sem disciplina";
    const t=q.tema||"Sem tema";
    if(disc && disc!=="TODAS" && d!==disc) continue;
    if(tema && tema!=="TODOS" && t!==tema) continue;
    const st=q.subtema||"";
    if(!st) continue;
    m.set(st,(m.get(st)||0)+1);
  }
  return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
}

export async function getDueCardIds(db,{disc="TODAS",tema="TODOS",subtema="TODOS",nivel="TODOS",limit=50,now=Date.now()}={}){
  const tx=db.transaction([STORE_C,STORE_Q],"readonly");
  const idx=tx.objectStore(STORE_C).index("due");
  const out=[];
  await new Promise((resolve,reject)=>{
    const r=idx.openCursor(IDBKeyRange.upperBound(now));
    r.onsuccess=()=>{const cur=r.result; if(!cur) return resolve();
      const c=cur.value;
      if(disc!=="TODAS" && c.disciplina!==disc){cur.continue(); return;}
      if(tema!=="TODOS" && c.tema!==tema){cur.continue(); return;}
      if(subtema!=="TODOS" && (c.subtema||"")!==subtema){cur.continue(); return;}
      const qreq=tx.objectStore(STORE_Q).get(c.id);
      qreq.onsuccess=()=>{
        const q=qreq.result;
        const nv=q?.nivel || "Médio";
        if(nivel!=="TODOS" && nv!==nivel){ cur.continue(); return; }
        out.push(c.id);
        if(out.length>=limit) return resolve();
        cur.continue();
      };
      qreq.onerror=()=>reject(qreq.error);
    };
    r.onerror=()=>reject(r.error);
  });
  await txDone(tx);
  return out;
}

export async function getNewCardIds(db,{disc="TODAS",tema="TODOS",subtema="TODOS",nivel="TODOS",limit=50}={}){
  const tx=db.transaction([STORE_C,STORE_Q],"readonly");
  const cs=tx.objectStore(STORE_C);
  const out=[];
  await new Promise((resolve,reject)=>{
    const r=cs.openCursor();
    r.onsuccess=()=>{const cur=r.result; if(!cur) return resolve();
      const c=cur.value;
      if(c.lastSeen && c.lastSeen>0){cur.continue(); return;}
      if(disc!=="TODAS" && c.disciplina!==disc){cur.continue(); return;}
      if(tema!=="TODOS" && c.tema!==tema){cur.continue(); return;}
      if(subtema!=="TODOS" && (c.subtema||"")!==subtema){cur.continue(); return;}
      const qreq=tx.objectStore(STORE_Q).get(c.id);
      qreq.onsuccess=()=>{
        const q=qreq.result;
        const nv=q?.nivel || "Médio";
        if(nivel!=="TODOS" && nv!==nivel){ cur.continue(); return; }
        out.push(c.id);
        if(out.length>=limit) return resolve();
        cur.continue();
      };
      qreq.onerror=()=>reject(qreq.error);
    };
    r.onerror=()=>reject(r.error);
  });
  await txDone(tx);
  return out;
}
