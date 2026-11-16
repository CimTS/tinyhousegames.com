'use strict';
const stage=document.querySelector('#stage');
const game=document.querySelector('#game');
const loading=document.querySelector('#loading');
const launch=document.querySelector('#launch');
const fullscreen=document.querySelector('#fullscreen');
let launched=false;
launch.addEventListener('click',async()=>{
  document.body.classList.add('game-active');
  stage.scrollIntoView({block:'start'});
  if(launched){game.contentWindow.focus();return;}
  launched=true;
  loading.innerHTML='<strong>CONNECTING TO OUTPOST</strong><p>Loading the game. The first visit downloads about 39 MB.</p>';
  try{
    for(const name of ['index.html','index.js','index.wasm','index.pck']){
      const response=await fetch('runtime/d392492-33c13994/'+name,{method:'HEAD'});
      if(!response.ok)throw new Error('Runtime resource unavailable: '+name+' ('+response.status+').');
    }
    game.hidden=false;
    game.src='runtime/d392492-33c13994/index.html';
  }catch(error){
    loading.innerHTML='<strong>CONNECTION FAILED</strong><p></p>';
    loading.querySelector('p').textContent=error.message+' Reload this page to retry.';
  }
});
function checkRuntime(){
  if(!launched)return;
  try{
    const doc=game.contentDocument;
    if(!doc||!doc.querySelector('#canvas'))return;
    const notice=doc.querySelector('#status-notice');
    if(notice&&notice.textContent.trim()){
      loading.hidden=false;
      loading.innerHTML='<strong>CONNECTION FAILED</strong><p></p>';
      loading.querySelector('p').textContent=notice.textContent+' Reload this page to retry.';
      clearInterval(monitor);
    }else if(doc.readyState==='complete'&&!game.contentWindow.Engine){
      loading.innerHTML='<strong>CONNECTION FAILED</strong><p>The game loader is unavailable. Reload this page to retry.</p>';
      clearInterval(monitor);
    }else if(!doc.querySelector('#status')){
      loading.hidden=true;
      game.contentWindow.focus();
      clearInterval(monitor);
    }
  }catch{
    loading.innerHTML='<strong>CONNECTION FAILED</strong><p>The game document could not be read. Reload this page to retry.</p>';
    clearInterval(monitor);
  }
}
const monitor=setInterval(checkRuntime,200);
game.addEventListener('load',checkRuntime);
if(document.fullscreenEnabled&&stage.requestFullscreen){
  fullscreen.hidden=false;
  fullscreen.addEventListener('click',async()=>{
    try{await stage.requestFullscreen();}catch{fullscreen.textContent='FULLSCREEN UNAVAILABLE';fullscreen.disabled=true;}
  });
}

document.querySelector("#field-view").addEventListener("click",()=>stage.scrollIntoView({block:"start"}));
document.querySelector("#controls-view").addEventListener("click",()=>window.scrollTo({top:scrollY+stage.getBoundingClientRect().bottom-innerHeight+60}));
