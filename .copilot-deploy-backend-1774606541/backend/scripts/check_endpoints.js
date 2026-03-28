const http = require('http');
const endpoints = ['/api/categories','/api/packages','/api/materials'];

function get(path){
  return new Promise((resolve,reject)=>{
    http.get('http://localhost:5000'+path,(res)=>{
      let s='';
      res.on('data',c=>s+=c);
      res.on('end',()=>resolve({status:res.statusCode, body:s}));
    }).on('error',e=>reject(e));
  });
}

(async()=>{
  for(const p of endpoints){
    try{
      const r = await get(p);
      console.log('---',p,'status',r.status);
      try{ console.log(JSON.stringify(JSON.parse(r.body),null,2)); }
      catch(e){ console.log(r.body || '(empty)'); }
    }catch(e){
      console.error('ERR',p,e.message);
    }
  }
})();
