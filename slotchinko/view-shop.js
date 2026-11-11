/* Slotchinko shop and loadout markup. */
(() => {
  "use strict";
  const {BALANCE}=window.SlotchinkoData;
  const $=id=>document.getElementById(id);
  const P=window.GameView.prototype;

  /* The open Chip: what it does and, when it can be sold, the Sell button. One tap opens it, so a sale is always two taps. */
  P.renderChipDetail=function(s,stacks){
    const box=$("chip-detail"),entry=this.chipOpen&&stacks.get(this.chipOpen);
    if(!entry){this.chipOpen=null;box.hidden=true;box.innerHTML="";document.body.classList.remove("chip-open");return;}
    const c=entry.chip,g=this.game,owned=s.chips.filter(x=>x.id===c.id),value=Math.max(0,...owned.map(x=>g.sellValue(x)));
    const why=!s.chips.includes(c)?"Lasts the whole run.":!value?"Part of your deck. It can't be sold.":!g.canSell()?"You can sell when the drop is over.":"";
    box.hidden=false;document.body.classList.add("chip-open");
    box.innerHTML=`<div class="chip-detail-copy"><b>${c.icon} ${c.name}${entry.n>1?` ×${entry.n}`:""}</b><span>${c.desc}</span>${why?`<small>${why}</small>`:""}</div>
      ${why?"":`<button type="button" class="sell-chip" data-sell="${c.id}" aria-label="Sell ${entry.n>1?"one ":""}${c.name} for ${value} coins"><span>SELL${entry.n>1?" ONE":""}</span><b>+${value}¢</b></button>`}`;
  };
  P.toggleChip=function(id){this.chipOpen=this.chipOpen===id?null:id;this.renderInventory(this.game.state);};
  P.renderInventory=function(s){
    const sig=JSON.stringify([s.chips.map(c=>c.id),(s.runBuffs||[]).map(c=>c.id),s.deckMods,s.consumables.map(c=>c.instanceId),s.phase,s.won,this.chipOpen||""]);
    if(!this.changed("inv",sig))return;
    const stacks=new Map();s.chips.forEach(c=>stacks.set(c.id,{chip:c,n:(stacks.get(c.id)?.n||0)+1}));
    $("inventory").hidden=!s.chips.length&&!s.consumables.length;
    $("loadout-count").textContent=`${s.chips.length}/${window.SlotchinkoData.BALANCE.MAX_CHIPS}`;
    (s.runBuffs||[]).forEach(c=>stacks.set(c.id,{chip:c,n:1}));
    $("owned-chips").innerHTML=[...stacks.values()].map(({chip:c,n})=>`<button type="button" class="owned-chip rarity-${c.rarity}${this.chipOpen===c.id?" is-open":""}" data-info="${c.id}" title="${c.desc}" aria-expanded="${this.chipOpen===c.id}" aria-controls="chip-detail" aria-label="${c.name}${n>1?`, ${n} copies`:""}"><span class="owned-icon">${c.icon}</span><span class="owned-name">${c.name}</span>${n>1?`<i>×${n}</i>`:""}</button>`).join("")||'<span class="empty-inventory">No Chips yet.</span>';
    this.renderChipDetail(s,stacks);
    const live=s.phase==="slot"||(s.phase==="roundEnd"&&s.won&&!s.victory);
    $("consumable-bag").innerHTML=s.consumables.map(c=>`<button type="button" class="consumable-item rarity-${c.rarity}" data-use="${c.instanceId}" title="${c.desc}" ${live?"":"disabled"} aria-label="Use ${c.name}: ${c.desc}"><span>${c.icon}</span><b>${c.name}</b><small>USE</small></button>`).join("")||'<span class="empty-inventory">Consumables appear here.</span>';
    $("consumable-count").textContent=`${s.consumables.length}/${this.game._bagMax()}`;
    const fx=this.game._effects();
    $("synergy-line").textContent=fx.synergies.length?fx.synergies.join("  ·  "):"No sets yet. Pair two different Chips with matching tags.";
  };

  const KIND_LABEL=item=>item.kind==="chip"?"PASSIVE CHIP":item.kind==="card"?"DECK CARD":item.kind==="buff"?(item.duration==="run"?"BOARD BUFF · RUN":"BOARD BUFF · NEXT DROP"):"BAG ITEM · ONE USE";
  // Shop sections, in stock order. Tabs filter; ALL shows every section with a header.
  const SECTIONS=[{tab:"chip",label:"CHIPS",icon:"✦",hint:"Passives for the whole run"},{tab:"card",label:"CARDS",icon:"▤",hint:"Change your deck"},
    {tab:"consumable",label:"BAG",icon:"▣",hint:"One use, any hand"},{tab:"buff",label:"BUFFS",icon:"◍",hint:"Bend the board"}];
  const tagText=item=>(item.tags||[]).join(" · ");
  const itemCard=(item,index,s)=>`
    <article class="shop-item rarity-${item.rarity} is-${item.kind}" style="--card-index:${index}">
      <div class="item-top">
        <span class="item-icon-wrap"><span class="item-icon">${item.icon}</span></span>
        <span class="rarity-label"><i></i>${item.rarity}</span>
      </div>
      <div class="item-copy">
        <b class="item-name">${item.name}</b>
        <p>${item.desc}</p>
        ${item.flavor?`<q class="item-flavor">${item.flavor.replace(/^"|"$/g,"")}</q>`:""}
        ${item.tags?`<small class="item-tags">${tagText(item)}</small>`:""}
      </div>
      <div class="item-bottom">
        <span class="item-kind">${KIND_LABEL(item)}</span>
        <button type="button" class="buy-chip" data-buy="${item.instanceId}" ${s.coins<item.cost?"disabled":""} aria-label="Buy ${item.name} for ${item.cost} coins"><span>BUY</span><b>${item.cost}¢</b></button>
      </div>
    </article>`;

  P.renderShop=function(s){
    const root=$("shop-content"),active=s.phase==="roundEnd"&&s.won&&!s.victory;
    document.body.classList.toggle("shop-active",active);
    const sig=active?JSON.stringify([s.shopInventory.map(x=>x.instanceId),s.coins,s.chips.length,s.consumables.length,s.shopRerolls,this.shopTab]):`closed:${s.phase}`;
    if(!this.changed("shop",sig))return;
    if(!active){
      root.innerHTML=`<div class="shop-empty-state"><span class="shop-empty-icon">✦</span><b>THE BLACK MARKET IS CLOSED</b><p>${s.phase==="roundEnd"?"The run is over.":"Clear the blind to unlock a fresh selection of Chips and consumables."}</p></div>`;
      return;
    }
    const inventory=s.shopInventory,cost=this.game._rerollCost();
    const tab=this.shopTab||"all",count=k=>inventory.filter(x=>x.kind===k).length;
    const freshStock=this.changed("stock",inventory.map(x=>x.id).join()+s.round+s.shopRerolls+tab);
    let i=0;
    const section=sec=>{const items=inventory.filter(x=>x.kind===sec.tab);if(!items.length)return "";
      return `<section class="shop-section">${tab==="all"?`<h3 class="shop-section-head"><span>${sec.icon}</span>${sec.label}<small>${sec.hint}</small></h3>`:""}<div class="shop-grid ${freshStock?"":"no-enter"}">${items.map(item=>itemCard(item,i++,s)).join("")}</div></section>`;};
    const shown=SECTIONS.filter(sec=>tab==="all"||sec.tab===tab).map(section).join("");
    root.innerHTML=`
      <div class="shop-toolbar">
        <div class="market-title"><span class="market-kicker">AFTER-BLIND EXCHANGE</span><b>BLACK MARKET <i>✦</i></b><small>Next: blind ${s.round+1}${s.path?.boss?" · BOSS":""}</small></div>
        <button type="button" id="reroll-shop" class="reroll-button" ${s.coins<cost?"disabled":""}><span>↻</span><b>REROLL</b><small>${cost}¢</small></button>
      </div>
      <button type="button" class="shop-loadout" data-open-loadout aria-haspopup="dialog"><span>YOUR CHIPS <b>${s.chips.length}/${BALANCE.MAX_CHIPS}</b></span><span>VIEW OR SELL ›</span></button>
      <div class="shop-tabs" role="tablist" aria-label="Shop sections">
        ${[{tab:"all",label:"ALL",n:inventory.length},...SECTIONS.map(x=>({...x,n:count(x.tab)}))].map(t=>`<button type="button" role="tab" class="shop-tab ${tab===t.tab?"is-active":""}" data-tab="${t.tab}" aria-selected="${tab===t.tab}">${t.label}<i>${t.n}</i></button>`).join("")}
      </div>
      ${shown||'<p class="shop-hint">Sold out here. Reroll for a fresh selection.</p>'}
      <div class="shop-footer"><span><b>✦ ${s.chips.length}/${BALANCE.MAX_CHIPS}</b> CHIPS</span><span><b>▣ ${s.consumables.length}/${this.game._bagMax()}</b> BAG</span><span><b>¢ ${s.coins}</b> WALLET</span></div>
      <button type="button" id="shop-next" class="btn btn-primary shop-next">CHOOSE YOUR PATH →</button>`;
  };
  P.setShopTab=function(tab){this.shopTab=tab;this.renderShop(this.game.state);};
})();
