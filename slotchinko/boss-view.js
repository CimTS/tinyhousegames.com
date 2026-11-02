/* Slotchinko boss UI: the panel above the board, the path preview, the trophy slot and the boss's lines.
   Wraps GameView.render so view.js stays boss-free. */
(() => {
  "use strict";
  const D=window.SlotchinkoData,$=id=>document.getElementById(id);
  const art=id=>`<span class="boss-art" aria-hidden="true">${window.SlotchinkoBossArt[id]}</span>`;
  const P=window.GameView.prototype,render=P.render;

  P.render=function(game){
    render.call(this,game);
    const s=game.state,st=game.bossStatus();
    this.renderBoss(s,st);this.renderTrophies(game);
    if(!st||st.beaten)return;
    if(s.boss==="sonny"){const n=new Set(s.cards.map(c=>c.suit)).size;$("balls-preview").textContent=`${n>1?"MIXED":D.SUIT_GLYPHS[s.cards[0].suit]} ${s.balls} BALLS`;}
    if(s.phase==="slot"){$("phase-label").textContent=`BOSS · ${st.boss.name.toUpperCase()}`;$("status-message").innerHTML=`“${st.boss.line}” <span class="boss-rule-note">${st.rule}. ${st.boss.hint}</span>`;}
  };
  P.renderBoss=function(s,st){
    const on=!!st&&(s.phase!=="roundEnd"||st.beaten),panel=$("boss-panel"),b=st?.boss;
    document.body.classList.toggle("boss-fight",on);
    panel.hidden=!on;$("boss-beaten").hidden=!on||!st.beaten;
    if(!on)return;
    const sig=[b.id,st.beaten,st.rule,st.live].join("|");
    if(!this.changed("boss",sig))return;
    panel.classList.toggle("is-beaten",st.beaten);
    panel.innerHTML=`${art(b.id)}<div class="boss-copy"><b>${st.beaten?`${b.name.toUpperCase()} · BEATEN`:st.title}</b><small>${st.beaten?`“${b.winLine}”`:st.rule}</small>${!st.beaten&&st.live?`<small class="boss-live">${st.live}</small>`:""}</div>`;
    if(st.beaten){$("boss-beaten").innerHTML=`${art(b.id)}<span><b>“${b.winLine}”</b><small>TROPHY · ${b.trophy.name}: ${b.trophy.desc}</small></span>`;}
  };
  P.renderTrophies=function(game){
    const own=game._trophyItems(),slot=$("trophy-slot");
    if(!this.changed("trophies",own.map(t=>t.id).join()))return;
    slot.hidden=!own.length;
    $("trophy-list").innerHTML=own.map(t=>{const b=D.BOSSES.find(x=>x.trophy===t);return `<button type="button" class="trophy rarity-${t.rarity}" data-trophy="${t.id}" title="${t.desc}" aria-label="${t.name}: ${t.desc}">${art(b.id)}<span>${t.name}</span></button>`;}).join("");
    $("trophy-count").textContent=`${own.length}/${D.BOSSES.length}`;
    $("inventory").hidden&&=!own.length;
  };

  window.SlotchinkoBossView={
    /* The path map names the next boss and its rule, however far off it is. */
    pathPreview(game){
      const s=game.state,b=D.BOSSES.find(x=>x.round>s.round),el=$("path-boss");
      el.hidden=!b;if(!b)return;
      el.innerHTML=`${art(b.id)}<span class="boss-copy"><b>${b.round===s.round+1?"BOSS NEXT":`BOSS AT BLIND ${b.round}`} · ${b.name}</b><em>${b.tagline}</em><small>${b.ruleName}: ${b.rules[game._bossTier()]}</small></span>`;
    },
    /* What the boss says on the end screen, and every trophy the run won. */
    endScreen(s,game){
      const b=D.BOSSES.find(x=>x.id===s.boss),line=s.victory?b?.winLine:!s.won?b?.line:null,el=$("end-boss-line");
      el.hidden=!line;if(line)el.textContent=`${b.name}: “${line}”`;
      const own=game._trophyItems();$("end-trophies").hidden=!own.length;
      $("end-trophies").innerHTML=own.map(t=>art(D.BOSSES.find(x=>x.trophy===t).id)).join("");
    },
    bind(view,game){
      $("trophy-list").addEventListener("click",e=>{const id=e.target.closest("[data-trophy]")?.dataset.trophy,t=id&&game._trophyItems().find(x=>x.id===id);if(t)view.toast(`${t.name}: ${t.desc}`);});
    }
  };
})();
