/* Slotchinko shop: stock generation, purchase, reroll and consumables. */
(() => {
  "use strict";
  const {CHIP_CATALOG,CARD_CATALOG,BUFF_CATALOG,CONSUMABLE_CATALOG,RARITY_WEIGHT,BALANCE}=window.SlotchinkoData;
  let serial=0;

  function weightedPick(items,random) {
    const total=items.reduce((sum,item)=>sum+(RARITY_WEIGHT[item.rarity]||0),0);
    let roll=random()*total;
    for(const item of items){roll-=RARITY_WEIGHT[item.rarity]||0;if(roll<=0)return item;}
    return items[items.length-1];
  }

  // Instance ids come from a counter kept in the run state, so a restored run never reuses one.
  function cloneItem(def,s,surcharge=0) {
    s.itemSerial=Math.max(s.itemSerial||0,serial)+1;serial=s.itemSerial;
    return {...def, cost:def.cost+surcharge, instanceId:`${def.id}-${s.itemSerial}`};
  }

  window.SlotchinkoShopLogic={
    /* Stock per section (BALANCE.SHOP_SLOTS), each picked by rarity weight without repeats. */
    generateShop(){
      const s=this.state,slots={...BALANCE.SHOP_SLOTS},rnd=this.rng.stream("shop"),open=d=>!(s.locked||[]).includes(d.id);
      if(s.deckId==="hoarder")slots.chip--;
      const pools={chip:CHIP_CATALOG.filter(d=>open(d)&&this._canOwn(d)),card:CARD_CATALOG.filter(d=>open(d)&&this._canOwn(d)),
        consumable:CONSUMABLE_CATALOG.filter(d=>open(d)&&!s.consumables.some(c=>c.id===d.id&&d.unique)),buff:BUFF_CATALOG.filter(d=>open(d)&&this._canOwn(d))};
      const inventory=[];
      for(const kind of ["chip","card","consumable","buff"]){
        const pool=[...pools[kind]];
        for(let i=0;i<slots[kind]&&pool.length;i++){
          const pick=weightedPick(pool,rnd);inventory.push(cloneItem(pick,s,this._ngHas("tight-shop")?1:0));
          pool.splice(pool.findIndex(item=>item.id===pick.id),1);
        }
      }
      s.shopInventory=inventory;s.shopRerolls=0;s.shopOpen=true;
      if(!s.path||s.path.round!==s.round)this._rollPath();
    },

    /* Whether one more of this item can be owned: chip stacks, deck cards, run buffs. */
    _canOwn(def){
      const s=this.state,m=s.deckMods||{};
      if(def.kind==="chip"){const n=this._ownedCount(def.id);return n===0||(def.stackable&&n<(def.maxStack||1));}
      if(def.kind==="card")return def.deck==="addAce"?(m.aces||0)<def.maxStack:!m[def.deck];
      if(def.kind==="buff")return def.duration!=="run"||!(s.runBuffs||[]).some(b=>b.id===def.id);
      return true;
    },

    purchase(instanceId){
      const s=this.state;if(s.phase!=="roundEnd"||!s.won||s.victory)return;
      const item=s.shopInventory.find(x=>x.instanceId===instanceId);
      if(!item||s.coins<item.cost)return;
      if(item.kind!=="consumable"&&!this._canOwn(item))return;
      if(item.kind==="chip"){
        if(s.chips.length>=BALANCE.MAX_CHIPS){this.toast(`CHIP SLOTS FULL · ${BALANCE.MAX_CHIPS} MAX`);return;}
        s.chips.push({...item,instanceId:`owned-${item.instanceId}`});
      }else if(item.kind==="card"){
        const m=s.deckMods;
        if(item.deck==="addAce")m.aces=(m.aces||0)+1;else m[item.deck]=true;
      }else if(item.kind==="buff"){
        if(item.duration==="run")s.runBuffs.push({...item,instanceId:`run-${item.instanceId}`});
        else s.pendingBoosts.push({action:item.action,value:item.value,id:item.id});
      }else{
        if(s.consumables.length>=this._bagMax()){this.toast(`BAG FULL · ${this._bagMax()} MAX`);return;}
        s.consumables.push({...item,instanceId:`bag-${item.instanceId}`});if(s.stats)s.stats.maxBag=Math.max(s.stats.maxBag||0,s.consumables.length);
      }
      s.coins-=item.cost;s.shopInventory=s.shopInventory.filter(x=>x.instanceId!==instanceId);
      const note=item.kind==="buff"?(item.duration==="run"?" · WHOLE RUN":" · NEXT DROP"):item.kind==="card"?" · DECK UPDATED":" ACQUIRED";
      this.toast(`${item.name.toUpperCase()}${note}`);this.render();
    },

    _rerollCost(){return BALANCE.REROLL_BASE+this.state.shopRerolls+(this._ngHas("pricey-rerolls")?2:0);},
    rerollShop(){
      const s=this.state;if(s.phase!=="roundEnd"||!s.won||s.victory)return;
      const cost=this._rerollCost();
      if(s.coins<cost){this.toast("NOT ENOUGH COINS TO REROLL");return;}
      s.coins-=cost;
      const nextRerollCount=s.shopRerolls+1;
      this.generateShop();
      s.shopRerolls=nextRerollCount;
      this.toast(`SHOP REROLLED · -${cost}¢`);this.render();
    },

    /* Usable while preparing a hand and in the shop. Blind Skip only works on a live blind. */
    useConsumable(instanceId){
      const s=this.state,inShop=s.phase==="roundEnd"&&s.won&&!s.victory;
      if(s.phase!=="slot"&&!inShop)return;
      const index=s.consumables.findIndex(c=>c.instanceId===instanceId);
      if(index<0)return;
      const item=s.consumables[index];
      if(item.action==="redeal"&&s.phase!=="slot"){this.toast("USE REDEAL WHILE PREPARING A HAND");return;}
      if(item.action==="skip"){
        if(inShop){this.toast("USE BLIND SKIP ON A LIVE BLIND");return;}
        if(s.round>=BALANCE.FINAL_BLIND){this.toast("THE FINAL BLIND CANNOT BE SKIPPED");return;}
      }
      s.consumables.splice(index,1);
      if(item.action==="coins"){s.coins+=item.value;if(s.stats)s.stats.coinsEarned+=item.value;this.toast(`+${item.value}¢`);}
      else if(item.action==="skip"){
        s.score=Math.max(s.score,s.target);this._payBlind();
        s.phase="roundEnd";s.won=true;this.generateShop();this.toast("BLIND SKIPPED · SHOP OPEN");
      }
      else if(item.action==="redeal"){
        s.deck=this._buildDeck();s.discardPile=[];s.cards=Array.from({length:5},()=>this._drawCard());
        s.held=[false,false,false,false,false];s.spins=0;this.toast("REDEALT · BOTH DRAWS BACK");this.view?.dealt?.([0,1,2,3,4]);
      }
      else if(item.action!=="none"){
        s.pendingBoosts.push({action:item.action,value:item.value});
        this.toast(`${item.name.toUpperCase()} · NEXT HAND`);
      }
      this.evaluateHand();this.render();
    }
  };
})();
