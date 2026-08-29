import puppeteer from 'puppeteer-core';
import fs from 'fs';
const OUT='/tmp/claude-1000/-home-vibudesh-Documents-sesh/83e753cf-941d-4fdd-9cef-8ec3013cf3a0/scratchpad/look';
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
for (const n of ['about','insights','quality','faq','products','markets']) {
  const p = await b.newPage();
  await p.setViewport({width:1440,height:900});
  await p.goto(`http://localhost:4173/${n}.html`,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,4200));
  const has = await p.evaluate(()=>!!document.querySelector('[data-gl="globe"]'));
  console.log(`${n.padEnd(10)} hero has globe: ${has}`);
  await p.screenshot({path:`${OUT}/${n}.png`, clip:{x:0,y:0,width:1440,height:760}});
  await p.close();
}
await b.close();
