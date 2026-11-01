/* Slotchinko settings, saved best score and full-screen overlays. */
(() => {
  "use strict";
  const KEY="slotchinko-save";
  const $=id=>document.getElementById(id);
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
  const write=data=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* private mode: play on, unsaved */}};
  const num=n=>Number(n).toLocaleString("en-US");

  class Prefs{
    constructor(){
      this.data={best:0,bestRound:0,wins:0,...read()};
      const sys=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if(this.data.motion===undefined)this.data.motion=sys?"reduced":"full";
      this.apply();
    }
    reducedMotion(){return this.data.motion==="reduced";}
    vibration(){return this.data.vibration!==false&&!this.reducedMotion();}
    setReduced(on){this.data.motion=on?"reduced":"full";this.apply();write(this.data);}
    apply(){document.documentElement.classList.toggle("reduce-motion",this.reducedMotion());}
    /* Returns true on a new best score. */
    recordRun(s){
      const d=this.data,isBest=s.score>d.best;
      if(isBest)d.best=s.score;
      d.bestRound=Math.max(d.bestRound,s.victory?s.round:s.round-1);
      if(s.victory)d.wins++;
      write(d);return isBest;
    }
  }

  class Overlays{
    constructor(prefs){this.prefs=prefs;this.open=null;this.onChange=()=>{};this.returnTo=null;}
    show(id){
      if(this.open)$(this.open).hidden=true;
      this.open=id;const el=$(id);el.hidden=false;this.onChange();
      el.querySelector("[data-focus]")?.focus({preventScroll:true});
    }
    hide(){
      if(!this.open)return;
      $(this.open).hidden=true;this.open=null;this.onChange();
    }
    get pausing(){return !!this.open;}
    showTitle(){
      const d=this.prefs.data;
      $("title-best").textContent=d.best?`BEST ${num(d.best)} · ${d.wins} WIN${d.wins===1?"":"S"}`:"NO RUNS YET";
      this.show("title-screen");
    }
    showHowTo(){
      this.returnTo=this.open==="title-screen"?"title":null;
      $("motion-toggle").checked=this.prefs.reducedMotion();
      this.show("howto-screen");
    }
    closeHowTo(){if(this.returnTo==="title"){this.returnTo=null;this.showTitle();}else this.hide();}
    showPause(){if(!this.open)this.show("pause-screen");}
    showEnd(s){
      const best=this.prefs.recordRun(s),d=this.prefs.data,cleared=s.victory?s.round:s.round-1;
      $("end-title").textContent=s.victory?"YOU BEAT THE HOUSE":"RUN OVER";
      $("end-screen").classList.toggle("is-win",!!s.victory);
      $("end-message").textContent=s.victory?"Every blind cleared. The table is yours.":`Blind ${s.round} wanted ${num(s.target)}. You had ${num(s.score)}.`;
      $("end-score").textContent=num(s.score);
      $("end-blinds").textContent=`${cleared}/${window.SlotchinkoData.BALANCE.FINAL_BLIND}`;
      $("end-best").textContent=num(d.best);
      $("end-new-best").hidden=!best;
      $("end-seed").textContent=`SEED ${window.slotchinko.rng.seed}`;
      this.show("end-screen");
    }
  }
  window.SlotchinkoPrefs=Prefs;window.SlotchinkoOverlays=Overlays;
})();
