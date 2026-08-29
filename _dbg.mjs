import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:'new',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
const reqs=[];
p.on('response', r => { if(/photo\//.test(r.url())) reqs.push(`${r.status()} ${r.url().split('/').pop()}`); });
p.on('requestfailed', r => { if(/photo\//.test(r.url())) reqs.push(`FAILED ${r.url().split('/').pop()}`); });
await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:4173/turmeric.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,5000));
console.log('photo requests:', reqs.length ? reqs.join(' | ') : 'NONE');
const info = await p.evaluate(()=>{
  const el=document.querySelector('[data-gl="column"]');
  const r=el.getBoundingClientRect();
  const cs=getComputedStyle(el);
  return { rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}, z:cs.zIndex, focus:el.dataset.focus };
});
console.log('stage:', JSON.stringify(info));
await b.close();
