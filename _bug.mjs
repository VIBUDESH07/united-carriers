import puppeteer from 'puppeteer-core';
import fs from 'fs';
const OUT='/tmp/claude-1000/-home-vibudesh-Documents-sesh/83e753cf-941d-4fdd-9cef-8ec3013cf3a0/scratchpad/bug';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:4173/about.html',{waitUntil:'domcontentloaded'});

const probe = async (label) => {
  const d = await p.evaluate(()=>{
    const c = document.getElementById('gl');
    const el = document.querySelector('[data-gl="column"]');
    const r = el ? el.getBoundingClientRect() : null;
    return {
      canvas: c ? `${c.width}x${c.height}` : 'none',
      canvasStyle: c ? getComputedStyle(c).display + '/' + getComputedStyle(c).opacity : 'none',
      stageRect: r ? `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.top)}` : 'none',
      loading: document.documentElement.classList.contains('is-loading'),
      loaderPresent: !!document.querySelector('[data-loader]'),
    };
  });
  console.log(label.padEnd(22), JSON.stringify(d));
};

for (const ms of [800, 1600, 2600, 4000]) {
  await new Promise(r=>setTimeout(r, ms===800?800:ms-800));
  await probe(`t=${ms}ms`);
  await p.screenshot({path:`${OUT}/t${ms}.png`, clip:{x:700,y:0,width:740,height:700}});
}
// now scroll down and back up
await p.evaluate(()=>window.scrollTo(0,900));
await new Promise(r=>setTimeout(r,700));
await p.evaluate(()=>window.scrollTo(0,0));
await new Promise(r=>setTimeout(r,900));
await probe('after scroll cycle');
await p.screenshot({path:`${OUT}/after.png`, clip:{x:700,y:0,width:740,height:700}});
await b.close();
