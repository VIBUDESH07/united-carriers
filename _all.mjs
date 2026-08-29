import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const BANNED=/FSSAI|HACCP|APEDA|Spices Board|ISO 22000|curcumin\s*[0-9]|99% purity|[0-9,]+\s*SHU|ASTA|United Arab Emirates|Saudi Arabia|contracted acreage|lab report|tested per lot|direct farm sourcing|cold store/i;
for (const n of ['index','about','products','quality','markets','insights','faq','contact','turmeric','cumin','coriander','chilli','pepper']) {
  const p = await b.newPage();
  const errs=[];
  p.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  p.on('console',m=>{if(m.type()==='error') errs.push('CONSOLE: '+m.text());});
  await p.setViewport({width:1440,height:900});
  await p.goto(`http://localhost:4173/${n}.html`,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,4200));
  const i = await p.evaluate(()=>({
    h:document.body.scrollHeight,
    over:document.documentElement.scrollWidth>window.innerWidth+1,
    text:document.body.innerText,
    gl:document.querySelectorAll('[data-gl]').length,
    anim:document.querySelectorAll('[data-sweep],[data-uncover],[data-tilt],[data-rule],[data-settle],[data-spine],[data-stage]').length,
  }));
  const hit=i.text.match(BANNED);
  console.log(`${n.padEnd(10)} h=${String(i.h).padEnd(6)} gl=${i.gl} anim=${String(i.anim).padEnd(3)} overflow=${i.over} banned=${hit?hit[0]:'none'} err=${errs.length?[...new Set(errs)].slice(0,1):'none'}`);
  await p.close();
}
// mobile spot-check
const m = await b.newPage();
await m.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await m.goto('http://localhost:4173/turmeric.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,3500));
console.log('\nmobile 390px overflow:', await m.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1));
await b.close();
