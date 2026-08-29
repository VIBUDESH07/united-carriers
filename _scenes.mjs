import puppeteer from 'puppeteer-core';
import fs from 'fs';
const OUT='/tmp/claude-1000/-home-vibudesh-Documents-sesh/83e753cf-941d-4fdd-9cef-8ec3013cf3a0/scratchpad/sc';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
for (const n of ['about','quality','markets','insights','faq','contact','turmeric','products']) {
  const p = await b.newPage();
  const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error') errs.push(m.text());});
  await p.setViewport({width:1440,height:900});
  await p.goto(`http://localhost:4173/${n}.html`,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,4800));
  console.log(`${n.padEnd(10)} err=${errs.length?[...new Set(errs)].slice(0,1):'none'}`);
  await p.screenshot({path:`${OUT}/${n}.png`, clip:{x:700,y:0,width:740,height:700}});
  await p.close();
}
// the cube act
const p = await b.newPage();
await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:4173/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,6000));
const g = await p.evaluate(()=>{
  const t=document.querySelector('[data-gl="cube"]').closest('[data-act-track]').getBoundingClientRect();
  return {top:Math.round(t.top+window.scrollY),h:Math.round(t.height)};
});
for (const f of [0.08,0.3,0.55,0.8]) {
  await p.evaluate(y=>window.scrollTo(0,y), Math.round(g.top+(g.h-900)*f));
  await new Promise(r=>setTimeout(r,1300));
  await p.screenshot({path:`${OUT}/cube-${Math.round(f*100)}.png`});
}
await b.close();
