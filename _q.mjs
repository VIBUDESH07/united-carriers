import puppeteer from 'puppeteer-core';
import fs from 'fs';
const OUT='/tmp/claude-1000/-home-vibudesh-Documents-sesh/83e753cf-941d-4fdd-9cef-8ec3013cf3a0/scratchpad/q';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error') errs.push(m.text());});
await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:4173/quality.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,5000));
console.log('quality err=', errs.length?[...new Set(errs)].slice(0,2):'none');
await p.screenshot({path:`${OUT}/quality.png`, clip:{x:640,y:0,width:800,height:760}});
await p.close();

const c = await b.newPage();
await c.setViewport({width:1440,height:900});
await c.goto('http://localhost:4173/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,6000));
const g = await c.evaluate(()=>{
  const t=document.querySelector('[data-gl="cube"]').closest('[data-act-track]').getBoundingClientRect();
  return {top:Math.round(t.top+window.scrollY),h:Math.round(t.height)};
});
for (const f of [0.08,0.45,0.85]) {
  await c.evaluate(y=>window.scrollTo(0,y), Math.round(g.top+(g.h-900)*f));
  await new Promise(r=>setTimeout(r,1300));
  await c.screenshot({path:`${OUT}/cube-${Math.round(f*100)}.png`});
}
await b.close();
