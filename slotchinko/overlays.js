/* Slotchinko settings, saved best score and full-screen overlays. */
(() => {
  "use strict";
  const KEY="slotchinko-save";
  const $=id=>document.getElementById(id);
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}};
  const write=data=>{try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* private mode: play on, unsaved */}};
  const num=n=>Number(n).toLocaleString("en-US");

  const FRESH=()=>({best:0,bestRound:0,wins:0,ngUnlocked:0,found:[],deckBest:{},setsFound:[]});
  class Prefs{
    constructor(){
      this.data={...FRESH(),...read()};
      // Older saves: a first win used to open every deck at once.
      if(this.data.decksUnlocked){this.data.found=[...new Set([...this.data.found,...window.SlotchinkoData.DECKS.map(k=>k.id)])];delete this.data.decksUnlocked;}
      const sys=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if(this.data.motion===undefined)this.data.motion=sys?"reduced":"full";
      this.apply();
    }
    reducedMotion(){return this.data.motion==="reduced";}
    vibration(){return this.data.vibration!==false&&!this.reducedMotion();}
    setReduced(on){this.data.motion=on?"reduced":"full";this.apply();write(this.data);}
    /* Clear save data: best scores, wins, unlocks, Ascension and the Collection (motion preference kept). */
    reset(){const motion=this.data.motion;this.data={...FRESH(),motion};write(this.data);}
    apply(){document.documentElement.classList.toggle("reduce-motion",this.reducedMotion());}
    /* Ids still locked in the unlock pool, for a new run. */
    locked(){return window.SlotchinkoData.UNLOCKS.map(u=>u.id).filter(id=>!this.data.found.includes(id));}
    deckOpen(id){return id==="house"||this.data.found.includes(id);}
    /* Records a finished run: best score, wins, Ascension, sets found and new unlocks. */
    recordRun(s,game){
      const d=this.data,isBest=s.total>d.best;
      if(isBest)d.best=s.total;
      d.bestRound=Math.max(d.bestRound,s.victory?s.round:s.round-1);
      let ascended=false;
      if(s.victory){
        d.wins++;const ng=s.ng||0;d.deckBest[s.deckId||"house"]=Math.max(d.deckBest[s.deckId||"house"]??-1,ng);
        const open=Math.min(window.SlotchinkoData.NG.MAX,ng+1);if(open>(d.ngUnlocked||0)){d.ngUnlocked=open;ascended=true;}
      }
      const fresh=game?game.newUnlocks(d.found):[];d.found.push(...fresh);
      d.setsFound=[...new Set([...(d.setsFound||[]),...(s.stats?.sets||[])])];
      write(d);return {isBest,fresh,ascended};
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
      $("title-best").textContent=d.best?`BEST ${num(d.best)} · ${d.wins} WIN${d.wins===1?"":"S"}${d.ngUnlocked?` · ASCENSION ${d.ngUnlocked}`:""}`:"NO RUNS YET";
      const saved=window.SlotchinkoSave?.read(),c=$("continue-button");
      if(c){c.hidden=!saved;if(saved){const st=saved.state;$("continue-detail").textContent=`BLIND ${st.round}/${window.SlotchinkoData.BALANCE.FINAL_BLIND} · ${num(st.total||0)} PTS${st.ng?` · ASC ${st.ng}`:""}`;}}
      $("play-button").setAttribute("data-focus","");if(saved)$("play-button").removeAttribute("data-focus");if(c)c.toggleAttribute("data-focus",!!saved);
      this.show("title-screen");
    }
    showHowTo(){
      this.returnTo=this.open==="title-screen"?"title":null;
      $("motion-toggle").checked=this.prefs.reducedMotion();
      this.show("howto-screen");
    }
    closeHowTo(){if(this.returnTo==="title"){this.returnTo=null;this.showTitle();}else this.hide();}
    showSettings(){
      this.settingsReturn=this.open&&this.open!=="settings-screen"?this.open:null;
      this.show("settings-screen");
    }
    closeSettings(){const back=this.settingsReturn;this.settingsReturn=null;if(back==="title-screen")this.showTitle();else if(back)this.show(back);else this.hide();}
    showPause(){if(!this.open)this.show("pause-screen");}
    /* Deck select and Ascension level. Locked decks show the milestone that opens them. */
    showDecks(){
      const d=this.prefs.data,D=window.SlotchinkoData;
      if(this.deckPick==null||!this.prefs.deckOpen(this.deckPick))this.deckPick="house";
      this.ngPick=Math.max(0,Math.min(this.ngPick||0,d.ngUnlocked||0));
      const hint=id=>D.UNLOCKS.find(u=>u.id===id)?.hint||"";
      $("deck-list").innerHTML=D.DECKS.map(k=>{const open=this.prefs.deckOpen(k.id),picked=this.deckPick===k.id,best=d.deckBest?.[k.id];
        return `<button type="button" class="deck-card ${picked?"is-picked":""} ${open?"":"is-locked"}" data-deck="${k.id}" ${open?"":"disabled"} aria-pressed="${picked}">
          <span class="deck-head"><span class="deck-icon">${open?k.icon:"?"}</span>${best!=null?`<span class="deck-best" title="Best Ascension won">★ ${best}</span>`:""}</span>
          <b>${open?k.name:"Locked"}</b><small>${open?k.desc:hint(k.id)}</small></button>`;}).join("");
      const n=this.ngPick,mods=D.NG.MODS.slice(0,n),pct=Math.round(((1+D.NG.TARGET_STEP*n)*(n>=8?D.NG.HIGH_STAKES:1)-1)*100);
      $("ng-level").textContent=n?`ASCENSION ${n}`:"STANDARD";
      $("ng-detail").textContent=n?`${pct?`Targets +${pct}% · `:""}${n} rule${n===1?"":"s"}`:(d.ngUnlocked?"Press + to raise the stakes.":"Win a run to open Ascension 1.");
      // Newest rule in full; earlier ones as a compact row.
      const last=mods[n-1],older=mods.slice(0,-1);
      $("ng-mods").innerHTML=(last?`<li class="is-new"><span>${last.icon}</span><b>${last.name}</b> ${last.desc}</li>`:"")+(older.length?`<li class="ng-older">Also: ${older.map(m=>`<b>${m.icon} ${m.name}</b>`).join(" · ")}</li>`:"");
      $("ng-mods").hidden=!n;
      $("ng-down").disabled=n<=0;$("ng-up").disabled=n>=(d.ngUnlocked||0);
      const found=D.DECKS.filter(k=>this.prefs.deckOpen(k.id)).length;$("deck-count").textContent=`${found}/${D.DECKS.length} OPEN`;
      this.show("deck-screen");
    }
    /* Collection: every Chip by family, the other items, sets found and decks. Locked tiles show their milestone. */
    showCollection(){
      const d=this.prefs.data,D=window.SlotchinkoData,locked=this.prefs.locked(),hint=id=>D.UNLOCKS.find(u=>u.id===id)?.hint||"";
      const tile=it=>{const open=!locked.includes(it.id);
        return `<li class="col-tile rarity-${it.rarity} ${open?"":"is-locked"}"><span class="col-icon">${open?it.icon:"?"}</span><span><b>${open?it.name:"Locked"}</b><small>${open?it.desc:hint(it.id)}</small></span></li>`;};
      const famOf=c=>D.FAMILIES.find(f=>(c.tags||[]).some(t=>f.tags.includes(t)))?.id||"chaos";
      const all=[...D.CHIP_CATALOG,...D.CARD_CATALOG,...D.BUFF_CATALOG,...D.CONSUMABLE_CATALOG];
      const openCount=all.filter(x=>!locked.includes(x.id)).length;
      const fams=D.FAMILIES.map(f=>{const items=D.CHIP_CATALOG.filter(c=>famOf(c)===f.id);if(!items.length)return "";
        return `<section class="col-family"><h3><span>${f.icon}</span>${f.name}<small>${items.filter(x=>!locked.includes(x.id)).length}/${items.length}</small></h3><ul class="col-grid">${items.map(tile).join("")}</ul></section>`;}).join("");
      const other=[["Deck Cards",D.CARD_CATALOG,"▤"],["Board Buffs",D.BUFF_CATALOG,"◍"],["Bag Items",D.CONSUMABLE_CATALOG,"▣"]]
        .map(([n,l,i])=>`<section class="col-family"><h3><span>${i}</span>${n}<small>${l.filter(x=>!locked.includes(x.id)).length}/${l.length}</small></h3><ul class="col-grid">${l.map(tile).join("")}</ul></section>`).join("");
      const sets=(window.SlotchinkoSets||[]).map(x=>{const got=(d.setsFound||[]).includes(x.label);
        return `<li class="${got?"is-found":""}"><b>${got?x.label:"? ? ?"}</b><small>${x.need.join(" + ")}</small></li>`;}).join("");
      const decks=D.DECKS.map(k=>{const open=this.prefs.deckOpen(k.id);return `<li class="col-tile ${open?"":"is-locked"}"><span class="col-icon">${open?k.icon:"?"}</span><span><b>${open?k.name:"Locked"}</b><small>${open?k.desc:hint(k.id)}</small></span></li>`;}).join("");
      $("collection-count").textContent=`${openCount}/${all.length} ITEMS · ${(d.setsFound||[]).length}/${(window.SlotchinkoSets||[]).length} SETS`;
      $("collection-body").innerHTML=`<p class="col-lead">Two different Chips with matching tags form a set. Locked items open from milestones.</p>
        <section class="col-family"><h3><span>✦</span>Sets found</h3><ul class="col-sets">${sets}</ul></section>
        ${fams}${other}
        <section class="col-family"><h3><span>♠</span>Decks</h3><ul class="col-grid">${decks}</ul></section>`;
      $("collection-body").scrollTop=0;
      this.show("collection-screen");
    }
    /* Path choice after the shop. */
    showPath(game){
      const s=game.state,D=window.SlotchinkoData;if(!s.path)return;
      if(s.event)return this.showEvent(game);
      const next=s.round+1;
      $("path-sub").textContent=`Blind ${next} of ${D.BALANCE.FINAL_BLIND}`;
      window.SlotchinkoBossView.pathPreview(game);
      const ev=id=>id&&game.eventDef(id);
      $("path-list").innerHTML=s.path.choices.map((c,i)=>{const n=D.NODES[c.type],e=c.type==="event"?ev(c.event):null;
        return `<button type="button" class="path-node is-${c.type}" data-path="${i}" ${i===0?"data-focus":""}><span class="path-icon">${n.icon}</span><span class="path-copy"><b>${n.name}</b><small>${e?`${e.name}. ${n.desc}`:n.desc}</small></span><i aria-hidden="true">›</i></button>`;}).join("");
      this.show("path-screen");
    }
    showEvent(game){
      const s=game.state,e=game.eventDef();if(!e)return;
      $("event-icon").textContent=e.icon;$("event-title").textContent=e.name;$("event-text").textContent=e.text;
      $("event-options").innerHTML=e.options.map((o,i)=>{const ok=game.eventOptionOk(i);
        return `<button type="button" class="event-option ${i===0?"is-main":""}" data-event="${i}" ${ok?"":"disabled"} ${i===0&&ok?"data-focus":""}><b>${o.label}</b><small>${ok?o.detail:o.need?`Needs ${o.need}¢. You have ${s.coins}¢.`:"You have no Chip to swap."}</small></button>`;}).join("");
      $("event-coins").textContent=`¢ ${s.coins}`;
      this.show("event-screen");
    }
    showEnd(s,sum){
      const game=window.slotchinko,rec=this.prefs.recordRun(s,game),best=rec.isBest,d=this.prefs.data,cleared=s.victory?s.round:s.round-1,D=window.SlotchinkoData;
      sum=sum||game.summary();
      $("end-hand").textContent=sum.bestHand;
      $("end-coins").textContent=`${num(sum.coinsEarned)}¢`;
      $("end-chip").textContent=sum.topChip?sum.topChip.name+(sum.topChip.times?` ×${sum.topChip.times}`:""):"—";
      $("end-drop").textContent=num(sum.bestDrop);
      const deck=D.DECKS.find(k=>k.id===(s.deckId||"house"));
      $("end-ng").hidden=false;$("end-ng").textContent=`${deck.name.toUpperCase()}${s.ng?` · ASCENSION ${s.ng}`:""}`;
      const names=rec.fresh.map(id=>{const u=D.UNLOCKS.find(x=>x.id===id),it=u.kind==="deck"?D.DECKS.find(k=>k.id===id):[...D.CHIP_CATALOG,...D.CARD_CATALOG,...D.BUFF_CATALOG,...D.CONSUMABLE_CATALOG].find(x=>x.id===id);return `<li><span>${it.icon}</span>${it.name}</li>`;});
      if(rec.ascended)names.unshift(`<li class="is-asc"><span>♛</span>Ascension ${d.ngUnlocked}</li>`);
      $("end-unlocks").hidden=!names.length;$("end-unlock-list").innerHTML=names.join("");
      const canNg=s.victory&&(s.ng||0)<D.NG.MAX;
      $("ng-button").hidden=!canNg;if(canNg)$("ng-button-level").textContent=`${(s.ng||0)+1}`;
      const choose=D.DECKS.some(k=>k.id!=="house"&&this.prefs.deckOpen(k.id))||d.ngUnlocked>0;
      $("deck-button").hidden=!choose;
      $("restart-button").classList.toggle("btn-primary",!canNg);$("restart-button").classList.toggle("btn-secondary",canNg);
      $("restart-button").toggleAttribute("data-focus",!canNg);$("ng-button").toggleAttribute("data-focus",canNg);
      $("end-title").textContent=s.victory?"YOU BEAT THE HOUSE":"RUN OVER";
      $("end-screen").classList.toggle("is-win",!!s.victory);
      $("end-message").textContent=s.victory?(canNg?`Every blind cleared. Ascension ${(s.ng||0)+1} awaits.`:"Every blind cleared. The table is yours."):`Blind ${s.round} wanted ${num(s.target)}. You had ${num(s.score)}.`;
      $("end-score").textContent=num(s.total);
      $("end-blinds").textContent=`${cleared}/${D.BALANCE.FINAL_BLIND}`;
      $("end-best").textContent=num(d.best);
      $("end-new-best").hidden=!best;
      $("end-seed").textContent=`SEED ${game.rng.seed}`;window.SlotchinkoBossView.endScreen(s,game);
      this.show("end-screen");
    }
  }
  window.SlotchinkoPrefs=Prefs;window.SlotchinkoOverlays=Overlays;
})();
