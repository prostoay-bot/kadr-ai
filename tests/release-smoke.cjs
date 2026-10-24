const {chromium}=require('playwright');
const {Document,Packer,Paragraph}=require('docx');
const {PDFDocument,StandardFonts}=require('pdf-lib');
const assert=require('node:assert/strict');
const url=process.env.KADR_URL||'http://127.0.0.1:8765/';
const fixture='ТРУДОВОЙ ДОГОВОР. ООО Пример. Вымышленный работник Иванов. Должность: специалист. Место работы: Москва. Оклад 100000 рублей. Ежегодный оплачиваемый отпуск 28 календарных дней. Рабочая неделя 40 часов. '.repeat(3);
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let ok=0,fail=0;
 async function check(name,fn){try{await fn();console.log('PASS '+name);ok++}catch(e){console.error('FAIL '+name+': '+e.message);fail++}}
 await check('App loads and audit opens',async()=>{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
  assert.equal(response.status(),200);
  await page.evaluate(()=>nav('audit'));
  await page.locator('#contractFile').waitFor({state:'attached'});
 });
 await check('TXT imports complete text',async()=>{
  await page.evaluate(()=>{document.getElementById('contractText').value='';document.getElementById('fileResult').textContent='';});
  await page.locator('#contractFile').setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>document.querySelector('#contractText')?.value.includes('100000'),{timeout:15000});
  assert.ok((await page.locator('#contractText').inputValue()).length>400);
 });
 await check('DOCX imports complete text',async()=>{
  const doc=new Document({sections:[{children:[new Paragraph(fixture)]}]});
  const buffer=await Packer.toBuffer(doc);
  await page.evaluate(()=>{document.getElementById('contractText').value='';document.getElementById('fileResult').textContent='';});
  await page.locator('#contractFile').setInputFiles({name:'fixture.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer});
  await page.waitForFunction(()=>{const txt=document.querySelector('#contractText')?.value||'';const state=document.querySelector('#fileResult')?.textContent||'';return (txt.includes('Вымышленный работник') && state.includes('✓')) || state.includes('Не удалось') || state.includes('часть документа')},{timeout:20000});
  assert.match(await page.locator('#contractText').inputValue(),/Вымышленный работник/);
  assert.doesNotMatch(await page.locator('#fileResult').innerText(),/Не удалось/);
 });
 await check('PDF imports text',async()=>{
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const pg=pdf.addPage([595,842]);
  pg.drawText('EMPLOYMENT AGREEMENT. Fictional employee. Salary 100000 RUB. Vacation 28 days.',{x:20,y:770,size:11,font});
  pg.drawText('Employment starts November 2026. Work location Moscow. Working week 40 hours.',{x:20,y:745,size:11,font});
  await page.evaluate(()=>{document.getElementById('contractText').value='';document.getElementById('fileResult').textContent='';});
  await page.locator('#contractFile').setInputFiles({name:'fixture.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.waitForFunction(()=>{const result=document.querySelector('#fileResult')?.textContent||'';const txt=document.querySelector('#contractText')?.value||'';return (result.includes('✓')&&txt.includes('EMPLOYMENT AGREEMENT'))||/Не удалось|слишком мало|не загрузился/.test(result)},{timeout:25000});
  assert.match(await page.locator('#fileResult').innerText(),/✓/);
  assert.match(await page.locator('#contractText').inputValue(),/EMPLOYMENT AGREEMENT/);
 });
 await check('Radar screen renders',async()=>{
  await page.evaluate(()=>nav('radar'));
  assert.match(await page.locator('body').innerText(),/Кадровый радар/);
 });
 await check('Law screen renders and legal text loads',async()=>{
  await page.evaluate(()=>nav('law'));
  assert.match(await page.locator('body').innerText(),/Центр законодательства/);
  await page.waitForFunction(()=>typeof tkCorpus!=='undefined'&&!!tkCorpus,{timeout:12000});
 });
 await check('Reject legacy DOC without silent fallback',async()=>{
  await page.evaluate(()=>nav('audit'));
  await page.locator('#contractFile').setInputFiles({name:'legacy.doc',mimeType:'application/msword',buffer:Buffer.from('synthetic test data')});
  assert.match(await page.locator('#fileResult').innerText(),/не поддерживается/);
 });
 await check('Mobile screen does not overflow horizontally',async()=>{
  await page.setViewportSize({width:375,height:812});
  await page.evaluate(()=>nav('audit'));
  const widths=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,page:document.documentElement.scrollWidth}));
  assert.ok(widths.page<=widths.viewport+2,JSON.stringify(widths));
  await page.setViewportSize({width:1280,height:800});
 });

 await check('Company audit: problematic employment contract',async()=>{
  const result=await page.evaluate(()=>{
   nav('audit');
   return reviewByType('contract','Трудовой договор. Место работы Москва. Должность специалист. Оклад 100000 рублей. Дата начала работы 02.11.2026. Ежегодный основной оплачиваемый отпуск 21 календарный день. Заработная плата выплачивается один раз в месяц. Режим работы с 09:00 до 18:00.').map(x=>({title:x.title,status:x.status}));
  });
  assert.ok(result.some(x=>/отпуска меньше 28/.test(x.title)));
  assert.ok(result.some(x=>/зарплат|заработн/i.test(x.title)&&x.status==='risk'));
  assert.ok(!result.some(x=>/Рабочая неделя свыше 40 часов/.test(x.title)));
 });
 await check('Company audit: PVTR illegal first lateness dismissal',async()=>{
  const result=await page.evaluate(()=>reviewByType('l_pvtr','Правила внутреннего трудового распорядка. Порядок приема и увольнения. Права и обязанности. Режим рабочего времени. Время отдыха. Поощрения. Дисциплинарные взыскания. Работодатель вправе уволить за первое опоздание. За опоздание работник платит штраф.'));
  assert.ok(result.some(x=>x.title==='Увольнение за первое опоздание'&&x.status==='violation'));
  assert.ok(result.some(x=>/Штраф/.test(x.title)&&x.status==='violation'));
 });
 await check('Company audit: pay regulation and privacy policy',async()=>{
  const result=await page.evaluate(()=>({
   pay:reviewByType('l_pay','Положение об оплате труда. Оклад и премирование, доплаты и надбавки. Сверхурочная работа оплачивается в одинарном размере.'),
   pd:reviewByType('l_pd','Положение о персональных данных. Цель обработки. Доступ и хранение. Передача данных третьим лицам без согласия работника.')
  }));
  assert.ok(result.pay.some(x=>/Сверхурочн/.test(x.title)&&x.status==='violation'));
  assert.ok(result.pd.some(x=>/Передача данных без согласия/.test(x.title)&&x.status==='violation'));
 });
 await check('Company audit: staffing specialist detected in hire order',async()=>{
  const result=await page.evaluate(()=>reviewByType('o_hire','Приказ о приеме № 5. Принять специалиста по кадрам с 02.11.2026.'));
  assert.ok(!result.some(x=>x.title==='Должность'&&x.status==='missing'));
 });
 await check('No unhandled JS exceptions',async()=>{assert.deepEqual(errors,[])});
 await browser.close();
 console.log('SUMMARY: '+ok+' passed, '+fail+' failed');
 if(fail)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
