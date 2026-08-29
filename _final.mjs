import puppeteer from 'puppeteer-core';
import fs from 'fs';
const OUT='/tmp/claude-1000/-home-vibudesh-Documents-sesh/83e753cf-941d-4fdd-9cef-8ec3013cf3a0/scratchpad/f';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});

// --- is three.js off the critical path? ---
const p0 = await b.newPage();
await p0.setViewport({width:1440,height:900});
let threeAt = null;
const t0 = Date.now();
p0.on('response', r => { if(/three-.*\.js/.test(r.url()) && threeAt===null) threeAt = Date.now()-t0; });
await p0.goto('http://localhost:4173/about.html',{waitUntil:'domcontentloaded'});
const paint = await p0.evaluate(()=>new Promise(res=>{
  new PerformanceObserver(l=>{const e=l.getEntries().find(x=>x.name==='first-contentful-paint'); if(e) res(Math.round(e.startTime));}).observe({type:'paint',buffered:true});
  setTimeout(()=>res(-1),4000);
}));
await new Promise(r=>setTimeout(r,4000));
console.log(`FCP ${paint}ms | three.js requested at ${threeAt}ms  -> ${threeAt>paint?'AFTER first paint (deferred)':'before paint'}`);
await p0.close();

for (const n of ['about','insights','turmeric','chilli']) {
  const p = await b.newPage();
  const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  await p.setViewport({width:1440,height:900});
  await p.goto(`http://localhost:4173/${n}.html`,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,5200));
  console.log(`${n.padEnd(10)} err=${errs.length?errs[0]:'none'}`);
  await p.screenshot({path:`${OUT}/${n}.png`, clip:{x:0,y:0,width:1440,height:780}});
  await p.close();
}
await b.close();
