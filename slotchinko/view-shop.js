/* Slotchinko shop and loadout markup. */
(() => {
  "use strict";
  const {BALANCE}=window.SlotchinkoData;
  const $=id=>document.getElementById(id);
  const P=window.GameView.prototype;

  P.renderInventory=function(s){
    const sig=JSON.stringify([s.chips.map(c=>c.id),s.consumables.map(c=>c.instanceId),s.phase,s.won]);
    if(!this.changed("inv",sig))return;
    const stacks=new Map();s.chips.forEach(c=>stacks.set(c.id,{chip:c,n:(stacks.get(c.id)?.n||0)+1}));
    $("inventory").hidden=!s.chips.length&&!s.consumables.length;
    $("owned-chips").innerHTML=[...stacks.values()].map(({chip:c,n})=>`<button type="button" class="owned-chip rarity-${c.rarity}" data-info="${c.id}">${c.icon} ${c.name}${n>1?` ×${n}`:""}</button>`).join("")||'<span class="empty-inventory">No Chips yet.</span>';
    const live=s.phase==="slot"||(s.phase==="roundEnd"&&s.won&&!s.victory);
    $("consumable-bag").innerHTML=s.consumables.map(c=>`<button type="button" class="consumable-item rarity-${c.rarity}" data-use="${c.instanceId}" ${live?"":"disabled"} aria-label="Use ${c.name}: ${c.desc}"><span>${c.icon}</span><b>${c.name}</b><small>USE</small></button>`).join("")||'<span class="empty-inventory">Consumables appear here.</span>';
    $("consumable-count").textContent=`${s.consumables.length}/${BALANCE.MAX_BAG}`;
    const fx=this.game._effects();
    $("synergy-line").textContent=fx.synergies.length?fx.synergies.join("  ·  "):"No sets yet. Pair two different Chips with matching tags.";
  };

  const tagText=item=>(item.tags||[]).join(" · ");
  const itemCard=(item,index,s)=>`
    <article class="shop-item rarity-${item.rarity} ${item.kind==="consumable"?"is-consumable":""}" style="--card-index:${index}">
      <div class="item-top">
        <span class="item-icon-wrap"><span class="item-icon">${item.icon}</span></span>
        <span class="rarity-label"><i></i>${item.rarity}</span>
      </div>
      <div class="item-copy">
        <b class="item-name">${item.name}</b>
        <p>${item.desc}</p>
        ${item.tags?`<small class="item-tags">${tagText(item)}</small>`:""}
      </div>
      <div class="item-bottom">
        <span class="item-kind">${item.kind==="chip"?"PASSIVE CHIP":"ONE-SHOT ITEM"}</span>
        <button type="button" class="buy-chip" data-buy="${item.instanceId}" ${s.coins<item.cost?"disabled":""} aria-label="Buy ${item.name} for ${item.cost} coins"><span>BUY</span><b>${item.cost}¢</b></button>
      </div>
    </article>`;

  P.renderShop=function(s){
    const root=$("shop-content"),active=s.phase==="roundEnd"&&s.won&&!s.victory;
    document.body.classList.toggle("shop-active",active);
    const sig=active?JSON.stringify([s.shopInventory.map(x=>x.instanceId),s.coins,s.chips.length,s.consumables.length,s.shopRerolls]):`closed:${s.phase}`;
    if(!this.changed("shop",sig))return;
    if(!active){
      root.innerHTML=`<div class="shop-empty-state"><span class="shop-empty-icon">✦</span><b>THE BLACK MARKET IS CLOSED</b><p>${s.phase==="roundEnd"?"The run is over.":"Clear the blind to unlock a fresh selection of Chips and consumables."}</p></div>`;
      return;
    }
    const inventory=s.shopInventory,cost=BALANCE.REROLL_BASE+s.shopRerolls;
    const chipCount=inventory.filter(item=>item.kind==="chip").length;
    const freshStock=this.changed("stock",inventory.map(x=>x.id).join()+s.round+s.shopRerolls);
    root.innerHTML=`
      <div class="shop-toolbar">
        <div class="market-title"><span class="market-kicker">AFTER-BLIND EXCHANGE</span><b>BLACK MARKET <i>✦</i></b><small>Next blind target: ${(BALANCE.BLIND_TARGETS[s.round]||0).toLocaleString("en-US")}</small></div>
        <button type="button" id="reroll-shop" class="reroll-button" ${s.coins<cost?"disabled":""}><span>↻</span><b>REROLL</b><small>${cost}¢</small></button>
      </div>
      <div class="shop-stockline"><span><i class="stock-dot"></i> ${inventory.length} IN STOCK</span><span>${chipCount} CHIPS <b>·</b> ${inventory.length-chipCount} CONSUMABLES</span></div>
      <div class="shop-grid ${freshStock?"":"no-enter"}">${inventory.map((item,i)=>itemCard(item,i,s)).join("")||'<p class="shop-hint">No stock remains. Reroll for a fresh selection.</p>'}</div>
      <div class="shop-footer"><span><b>✦ ${s.chips.length}/${BALANCE.MAX_CHIPS}</b> CHIPS</span><span><b>▣ ${s.consumables.length}/${BALANCE.MAX_BAG}</b> BAG</span><span><b>¢ ${s.coins}</b> WALLET</span></div>
      <button type="button" id="shop-next" class="btn btn-primary shop-next">NEXT BLIND →</button>`;
  };
})();
