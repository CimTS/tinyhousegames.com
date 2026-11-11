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
      const hover=e.pointerType==="mouse"&&(game.aimFlow.aiming||game.state.phase==="drop");  // a mouse aims without a button held
      if(!active&&!hover)return;
      if(e.cancelable)e.preventDefault();
      setAim(e);
    });
    canvas.addEventListener("pointerup",e=>{
      if(!active)return;
      if(e.cancelable)e.preventDefault();
      setAim(e);
      active=false;startedFromSlot=false;
      game.aimFlow.boardRelease();game.view.render(game);  // releasing only sets the aim; DROP confirms
    });
    const cancel=()=>{active=false;startedFromSlot=false;};
    canvas.addEventListener("pointercancel",cancel);
    canvas.addEventListener("lostpointercapture",cancel);
  }

  window.addEventListener("DOMContentLoaded",()=>{
    const prefs=new window.SlotchinkoPrefs(),overlays=new window.SlotchinkoOverlays(prefs);
    const {urlSeed,freshSeed}=window.SlotchinkoRNG;
    const nextSeed=()=>urlSeed()??freshSeed();
    const view=new window.GameView(prefs,overlays);
    const game=new window.SlotchinkoGame({view,seed:nextSeed(),locked:prefs.locked()});
    window.slotchinko=game;game.aimFlow=window.SlotchinkoAimFlow.create(game);
    const canvas=$("game-canvas"),board=new window.BoardView(canvas,()=>game.physics,()=>prefs.reducedMotion());
    view.attach(game,board);game.render();window.SlotchinkoBossView.bind(view,game);

    document.querySelectorAll(".reel").forEach(reel=>{
      reel.addEventListener("click",()=>game.toggleHold(Number(reel.dataset.index)));
    });
    $("spin-button").addEventListener("click",()=>game.spin());
    $("drop-button").addEventListener("click",()=>{
      if(game.state.phase==="slot"){game.aimFlow.press();game.view.render(game);}
      else overlays.showPath(game);
    });
    $("shop-content").addEventListener("click",e=>{
      const buy=e.target.closest("[data-buy]");
      if(buy)game.purchase(buy.dataset.buy);
      else if(e.target.closest("#reroll-shop"))game.rerollShop();
      else if(e.target.closest("#shop-next"))overlays.showPath(game);
      else if(e.target.closest("[data-tab]"))view.setShopTab(e.target.closest("[data-tab]").dataset.tab);
    });
    $("consumable-bag").addEventListener("click",e=>{
      const use=e.target.closest("[data-use]");
      if(use&&!use.disabled)game.useConsumable(use.dataset.use);
    });
    $("owned-chips").addEventListener("click",e=>{
      const info=e.target.closest("[data-info]");
      if(info)view.toggleChip(info.dataset.info);
    });
    $("loadout-open").addEventListener("click",()=>overlays.showLoadout(game));
    $("loadout-close").addEventListener("click",()=>overlays.closeLoadout());
    $("loadout-body").addEventListener("click",e=>{
      const sell=e.target.closest("[data-sell]");if(!sell)return;
      const body=$("loadout-body"),top=body.scrollTop;game.sellChip(sell.dataset.sell);overlays.showLoadout(game);body.scrollTop=top;
    });
    $("chip-detail").addEventListener("click",e=>{
      const sell=e.target.closest("[data-sell]");
      if(sell)game.sellChip(sell.dataset.sell);
    });
    game.autosave=true;
    const save=window.SlotchinkoSave;
    const newRun=(opts={})=>{save.clear();game.newRun(nextSeed(),{ng:opts.ng??0,deckId:opts.deckId??"house",locked:prefs.locked()});overlays.hide();};
    // NEW RUN: straight in until decks unlock, then the deck select.
    const hasChoice=()=>prefs.data.ngUnlocked>0||window.SlotchinkoData.DECKS.some(k=>k.id!=="house"&&prefs.deckOpen(k.id));
    $("play-button").addEventListener("click",()=>hasChoice()?overlays.showDecks():newRun());
    $("title-collection").addEventListener("click",()=>overlays.showCollection());
    $("collection-close").addEventListener("click",()=>overlays.showTitle());
    // The path between blinds, and event cards.
    $("path-list").addEventListener("click",e=>{const b=e.target.closest("[data-path]");if(!b)return;
      game.choosePath(Number(b.dataset.path));if(game.state.event)overlays.showEvent(game);else overlays.hide();});
    $("path-back").addEventListener("click",()=>overlays.hide());
    $("event-options").addEventListener("click",e=>{const b=e.target.closest("[data-event]");if(!b||b.disabled)return;
      game.resolveEvent(Number(b.dataset.event));if(!game.state.event)overlays.hide();});
    $("continue-button").addEventListener("click",()=>{const d=save.read();if(d)save.restore(game,d);if(game.state.event)overlays.showEvent(game);else overlays.hide();});
    $("deck-list").addEventListener("click",e=>{const b=e.target.closest("[data-deck]");if(b&&!b.disabled){overlays.deckPick=b.dataset.deck;overlays.showDecks();}});
    $("ng-down").addEventListener("click",()=>{overlays.ngPick=Math.max(0,(overlays.ngPick||0)-1);overlays.showDecks();});
    $("ng-up").addEventListener("click",()=>{overlays.ngPick=Math.min(prefs.data.ngUnlocked||0,(overlays.ngPick||0)+1);overlays.showDecks();});
    $("deck-start").addEventListener("click",()=>newRun({ng:overlays.ngPick||0,deckId:overlays.deckPick||"house"}));
    $("deck-back").addEventListener("click",()=>overlays.showTitle());
    $("ng-button").addEventListener("click",()=>{overlays.ngPick=Math.min(prefs.data.ngUnlocked||0,(game.state.ng||0)+1);overlays.deckPick=game.state.deckId||"house";overlays.showDecks();});
    $("deck-button").addEventListener("click",()=>{overlays.ngPick=game.state.ng||0;overlays.deckPick=game.state.deckId||"house";overlays.showDecks();});
    // Clear save data (settings panel), with a confirm step.
    const confirmBox=$("clear-confirm");
    $("clear-save").addEventListener("click",()=>{confirmBox.hidden=false;$("clear-save").hidden=true;});
    const closeConfirm=()=>{confirmBox.hidden=true;$("clear-save").hidden=false;$("clear-settings").checked=false;};
    $("clear-cancel").addEventListener("click",closeConfirm);
    $("clear-yes").addEventListener("click",()=>{
      save.clear();prefs.reset();
      if($("clear-settings").checked){try{["slotchinko-audio","slotchinko-muted"].forEach(k=>localStorage.removeItem(k));}catch{/* ignore */}window.SlotchinkoSound?.setVolume?.("music",1);window.SlotchinkoSound?.setVolume?.("sfx",1);window.SlotchinkoSound?.setMuted?.(false);}
      closeConfirm();view.toast("SAVE DATA CLEARED");
    });
    $("title-howto").addEventListener("click",()=>overlays.showHowTo());
    $("help-button").addEventListener("click",()=>overlays.showHowTo());
    $("settings-button").addEventListener("click",()=>overlays.open==="settings-screen"?overlays.closeSettings():overlays.showSettings());
    $("title-settings").addEventListener("click",()=>overlays.showSettings());
    $("settings-close").addEventListener("click",()=>overlays.closeSettings());
    $("settings-screen").addEventListener("click",e=>{if(e.target.id==="settings-screen")overlays.closeSettings();});
    $("howto-close").addEventListener("click",()=>overlays.closeHowTo());
    $("restart-button").addEventListener("click",()=>newRun({ng:game.state.ng||0,deckId:game.state.deckId||"house"}));
    $("pause-resume").addEventListener("click",()=>overlays.hide());
    $("motion-toggle").addEventListener("change",e=>prefs.setReduced(e.target.checked));
    document.addEventListener("contextmenu",e=>e.preventDefault());
    bindAim(game,canvas);window.SlotchinkoKeys.bind(game,overlays);window.SlotchinkoCopy.apply();

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
// Offline play and install: a service worker for this folder only (same-origin cache, see sw.js).
if("serviceWorker" in navigator&&location.protocol!=="file:")window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js",{scope:"./"}).catch(()=>{}));
