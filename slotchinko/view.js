/* Slotchinko DOM view: writes game state to the page. Shop markup is in view-shop.js. */
(() => {
  "use strict";
  const {SUIT_GLYPHS,SUIT_NAMES,BALANCE}=window.SlotchinkoData;
  const $=id=>document.getElementById(id);
  const WORLD_W=340,AIM_INSET=24;
  const plural=n=>`${n} BALL${n===1?"":"S"}`;

  class GameView{
    constructor(prefs,overlays){
      this.prefs=prefs;this.overlays=overlays;this.sig={};
      const L=window.SlotchinkoPayoutLayer;
      this.payoutLayers=L?{hud:new L($("payout-layer")),board:new L($("payout-board"))}:null;
    }
    /* Coins pop under the coin counter; balls and points pop on the board. */
    payout(e){
      if(!this.payoutLayers)return;
      if(e.kind==="coin"){
        // Sit just under the top bar (below the coin counter, never over it); top of the screen once it scrolls away.
        const bar=document.querySelector(".topbar"),y=bar?bar.getBoundingClientRect().bottom:0;
        $("payout-layer").style.top=`${Math.max(10,Math.round(y)+8)}px`;
        if(bar&&bar.offsetWidth>560)$("payout-layer").style.right=`${Math.round(window.innerWidth-bar.getBoundingClientRect().right)}px`;  // the wide layout's bar ends at the board, not at 560px
        this.payoutLayers.hud.show(e);
      }else this.payoutLayers.board.show(e);
    }
    attach(game,board){this.game=game;this.board=board;}

    /* Skips DOM writes when nothing changed; render() runs on every landing ball. */
    changed(key,value){if(this.sig[key]===value)return false;this.sig[key]=value;return true;}

    render(game){
      const s=game.state;
      this.game=game;
      $("round-value").textContent=`${s.round}/${BALANCE.FINAL_BLIND}`;
      $("score-value").textContent=s.score.toLocaleString("en-US");
      $("target-value").textContent=s.target.toLocaleString("en-US");
      $("coins-value").textContent=s.coins;
      const pct=Math.min(100,100*s.score/s.target);
      $("target-bar-fill").style.width=`${pct}%`;
      $("target-bar").classList.toggle("is-hit",s.score>=s.target);
      $("target-bar").setAttribute("aria-valuenow",String(Math.round(pct)));
      $("hand-name").textContent=s.hand;
      $("hand-power").textContent=`×${Number(s.power.toFixed(2))}`;
      $("hand-detail").textContent=s.handDetail;
      $("balls-preview").textContent=`${SUIT_GLYPHS[s.primarySuit]} ${plural(s.balls)}`;
      $("balls-left").textContent=`BALLS: ${s.ballsLeft+s.activeBalls}`;
      $("round-earned").textContent=`THIS DROP: ${s.roundScore.toLocaleString("en-US")}`;
      const hn=BALANCE.HANDS_PER_BLIND;$("hand-count").textContent=window.SlotchinkoCopy.words(`HAND ${Math.min(hn,hn-(s.handsLeft||hn)+1)} OF ${hn} · TAP CARDS TO HOLD`);
      this.phaseText(s);
      this.buttons(s);
      this.cards(s);
      const overlay=$("board-overlay");
      overlay.classList.toggle("hidden",s.phase==="drop");
      overlay.textContent=s.phase==="roundEnd"?(s.victory?"YOU BEAT THE HOUSE":s.won?"BLIND CLEARED":"RUN OVER"):"YOUR BOARD IS WAITING";
      this.renderShop(s);this.renderInventory(s);this.renderAim();
      const next=`${s.phase}:${s.won}:${s.round}`;
      if(this.changed("flow",next)&&s.phase==="roundEnd"&&s.won&&!s.victory)this.scrollTo($("shop-ui"));
      if(s.phase==="slot"&&this.changed("hand",`${s.round}:${s.handsLeft}`))this.scrollTop();
    }

    phaseText(s){
      const shop=s.phase==="roundEnd"&&s.won;
      const need=Math.max(0,s.target-s.score).toLocaleString("en-US"),n=BALANCE.HANDS_PER_BLIND,at=n-(s.handsLeft||n)+1;
      const hands=at>=n?"Last hand.":`Hand ${at} of ${n}.`;
      $("phase-label").textContent=s.phase==="slot"?`PREPARE YOUR HAND · ${at}/${n}`:s.phase==="drop"?"THE DROP IS LIVE":s.victory?"YOU WIN":shop?"BLIND CLEARED":"RUN OVER";
      $("status-message").textContent=window.SlotchinkoCopy.words(s.phase==="slot"?(this.game.aimFlow?.aiming?"Aim: drag or tap the board, then tap DROP to release.":`${hands} You need ${need} more points. Tap cards to hold, draw up to twice, press Drop Hand to aim, then tap Drop.`):s.phase==="drop"?"Watch the balls fall. Drag across the board to aim the next ball.":s.victory?"Every blind beaten.":shop?"Buy Chips and consumables, reroll if needed, then enter the next blind.":"Your score fell short of the blind.");
    }

    buttons(s){
      const spin=$("spin-button"),drop=$("drop-button"),shop=s.phase==="roundEnd"&&s.won&&!s.victory;
      spin.disabled=s.phase!=="slot"||s.spins>=s.maxSpins;
      if(this.changed("spin",s.spins))spin.innerHTML=`↻ DRAW <span class="subtle">(${s.maxSpins-s.spins} LEFT)</span>`;
      const aiming=!!this.game.aimFlow?.aiming;
      if(this.changed("drop",shop+"|"+aiming))drop.innerHTML=shop?"CHOOSE PATH →":aiming?"DROP ●":"DROP HAND ↓";
      drop.classList.toggle("drop-confirm",aiming);document.body.classList.toggle("aiming",aiming);
      drop.disabled=!(shop||s.phase==="slot");
    }

    cards(s){
      document.querySelectorAll(".reel").forEach((el,i)=>{
        const card=s.cards[i];if(!card)return;const red=card.suit==="heart"||card.suit==="diamond";
        const rank=el.querySelector(".card-rank"),symbol=el.querySelector(".symbol");
        rank.textContent=card.label;rank.classList.toggle("red-card",red);
        symbol.textContent=SUIT_GLYPHS[card.suit];symbol.className=`symbol suit-${card.suit}`;
        el.classList.toggle("held",s.held[i]);el.querySelector("small").textContent=s.held[i]?"HELD":"HOLD";
        el.disabled=s.phase!=="slot";el.setAttribute("aria-pressed",String(s.held[i]));
        el.setAttribute("aria-label",`${card.label} of ${SUIT_NAMES[card.suit]}${s.held[i]?", held":""}`);
      });
    }

    renderAim(){
      const a=this.game.state.aim;
      $("aim-guide").style.left=`${(AIM_INSET+a*(WORLD_W-2*AIM_INSET))/WORLD_W*100}%`;
    }

    dealt(indexes){
      indexes.forEach(i=>{const el=document.querySelector(`.reel[data-index="${i}"]`);if(el){el.classList.remove("dealing");void el.offsetWidth;el.classList.add("dealing");}});
    }
    dropStarted(){this.scrollTo($("plinko-section"),"center");}
    ballScored(result,gained){
      if(this.board)this.board.score(result.index,gained>0?`+${gained.toLocaleString("en-US")}`:result.note||"DRAINED",gained>0);
    }
    targetHit(){
      const el=$("target-flash");el.classList.remove("show");void el.offsetWidth;el.classList.add("show");
      this.vibrate([30,40,30]);window.setTimeout(()=>el.classList.remove("show"),1300);
    }
    runEnded(){window.setTimeout(()=>this.overlays.showEnd(this.game.state),this.prefs.reducedMotion()?150:800);}

    scrollTop(){$("app").scrollTo({top:0,behavior:this.scrollMode()});}
    scrollTo(el,block="start"){window.setTimeout(()=>el.scrollIntoView({behavior:this.scrollMode(),block}),120);}
    scrollMode(){return this.prefs.reducedMotion()?"auto":"smooth";}
    vibrate(pattern){if(navigator.vibrate&&this.prefs.vibration())navigator.vibrate(pattern);}
    toast(message){
      const el=$("toast");el.textContent=message;el.classList.add("show");
      clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove("show"),1500);
    }
  }
  window.GameView=GameView;
})();
