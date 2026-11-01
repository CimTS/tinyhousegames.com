/* DOM event wiring and the fixed-step loop. Game rules live in game.js. */
(() => {
  "use strict";
  const STEP_MS=1000/60,MAX_FRAME_MS=50;
  const $=id=>document.getElementById(id);

  function bindAim(game,canvas){
    let active=false,startedFromSlot=false;
    const setAim=e=>{
      const rect=canvas.getBoundingClientRect();
      if(!rect.width)return;
      game.state.aim=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
      game.view.renderAim();
    };
    canvas.addEventListener("pointerdown",e=>{
      if(game.state.phase!=="slot"&&game.state.phase!=="drop")return;
      active=true;startedFromSlot=game.state.phase==="slot";
      if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);
      if(e.cancelable)e.preventDefault();
      setAim(e);
    });
    canvas.addEventListener("pointermove",e=>{
      if(!active)return;
      if(e.cancelable)e.preventDefault();
      setAim(e);
    });
    canvas.addEventListener("pointerup",e=>{
      if(!active)return;
      if(e.cancelable)e.preventDefault();
      setAim(e);
      const shouldStart=startedFromSlot&&game.state.phase==="slot";
      active=false;startedFromSlot=false;
      if(shouldStart)game.startDrop();
    });
    const cancel=()=>{active=false;startedFromSlot=false;};
    canvas.addEventListener("pointercancel",cancel);
    canvas.addEventListener("lostpointercapture",cancel);
  }

  function bindKeys(game,overlays){
    window.addEventListener("keydown",e=>{
      if(overlays.open){if(e.key==="Escape"&&overlays.open==="howto-screen")overlays.closeHowTo();return;}
      const s=game.state,onButton=e.target.closest?.("button");
      if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
        s.aim=Math.max(0,Math.min(1,s.aim+(e.key==="ArrowLeft"?-.05:.05)));game.view.renderAim();e.preventDefault();
      }
      else if(e.key>="1"&&e.key<="5")game.toggleHold(Number(e.key)-1);
      else if(e.key==="d"||e.key==="D")game.spin();
      else if(e.key==="Enter"&&!onButton)$("drop-button").click();
    });
  }

  window.addEventListener("DOMContentLoaded",()=>{
    const prefs=new window.SlotchinkoPrefs(),overlays=new window.SlotchinkoOverlays(prefs);
    const {urlSeed,freshSeed}=window.SlotchinkoRNG;
    const nextSeed=()=>urlSeed()??freshSeed();
    const view=new window.GameView(prefs,overlays);
    const game=new window.SlotchinkoGame({view,seed:nextSeed()});
    window.slotchinko=game;
    const canvas=$("game-canvas"),board=new window.BoardView(canvas,()=>game.physics,()=>prefs.reducedMotion());
    view.attach(game,board);game.render();

    document.querySelectorAll(".reel").forEach(reel=>{
      reel.addEventListener("click",()=>game.toggleHold(Number(reel.dataset.index)));
    });
    $("spin-button").addEventListener("click",()=>game.spin());
    $("drop-button").addEventListener("click",()=>{
      if(game.state.phase==="slot")game.startDrop();
      else game.nextRound();
    });
    $("shop-content").addEventListener("click",e=>{
      const buy=e.target.closest("[data-buy]");
      if(buy)game.purchase(buy.dataset.buy);
      else if(e.target.closest("#reroll-shop"))game.rerollShop();
      else if(e.target.closest("#shop-next"))game.nextRound();
    });
    $("consumable-bag").addEventListener("click",e=>{
      const use=e.target.closest("[data-use]");
      if(use&&!use.disabled)game.useConsumable(use.dataset.use);
    });
    $("owned-chips").addEventListener("click",e=>{
      const info=e.target.closest("[data-info]");
      const chip=info&&game.state.chips.find(c=>c.id===info.dataset.info);
      if(chip)view.toast(`${chip.name}: ${chip.desc}`);
    });
    const newRun=()=>{game.newRun(nextSeed());overlays.hide();};
    $("play-button").addEventListener("click",()=>overlays.hide());
    $("title-howto").addEventListener("click",()=>overlays.showHowTo());
    $("help-button").addEventListener("click",()=>overlays.showHowTo());
    $("howto-close").addEventListener("click",()=>overlays.closeHowTo());
    $("restart-button").addEventListener("click",newRun);
    $("pause-resume").addEventListener("click",()=>overlays.hide());
    $("motion-toggle").addEventListener("change",e=>prefs.setReduced(e.target.checked));
    document.addEventListener("contextmenu",e=>e.preventDefault());
    bindAim(game,canvas);bindKeys(game,overlays);

    // The sim only ticks while visible and with no overlay up, so a hidden tab holds still.
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden&&game.state.phase==="drop")overlays.showPause();
    });
    let last=0,bank=0;
    const frame=now=>{
      if(!overlays.pausing&&!document.hidden){
        bank+=Math.min(now-last,MAX_FRAME_MS);
        while(bank>=STEP_MS){game.step();bank-=STEP_MS;}
      }
      last=now;board.draw();window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(t=>{last=t;frame(t);});
    overlays.showTitle();
  });
})();
