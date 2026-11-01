/* Slotchinko shop: stock generation, purchase, reroll and consumables. */
(() => {
  "use strict";
  const {CHIP_CATALOG,CONSUMABLE_CATALOG,RARITY_WEIGHT,BALANCE}=window.SlotchinkoData;
  let serial=0;

  function weightedPick(items,random) {
    const total=items.reduce((sum,item)=>sum+(RARITY_WEIGHT[item.rarity]||0),0);
    let roll=random()*total;
    for(const item of items){roll-=RARITY_WEIGHT[item.rarity]||0;if(roll<=0)return item;}
    return items[items.length-1];
  }

  function cloneItem(def) {
    return {...def, instanceId:`${def.id}-${++serial}`};
  }

  window.SlotchinkoShopLogic={
    generateShop(){
      const s=this.state;
      const eligible=CHIP_CATALOG.filter(def=>{
        const count=this._ownedCount(def.id);
        return count===0|| (def.stackable&&count<(def.maxStack||1));
      });
      const inventory=[];
      const pool=[...eligible];
      while(inventory.length<4&&pool.length){
        const pick=weightedPick(pool,this.rng.stream("shop"));inventory.push(cloneItem(pick));
        pool.splice(pool.findIndex(item=>item.id===pick.id),1);
      }
      const consumablePool=CONSUMABLE_CATALOG.filter(def=>!s.consumables.some(c=>c.id===def.id&&c.unique));
      while(inventory.length<6&&consumablePool.length){
        const pick=weightedPick(consumablePool,this.rng.stream("shop"));inventory.push(cloneItem(pick));
        consumablePool.splice(consumablePool.findIndex(item=>item.id===pick.id),1);
      }
      s.shopInventory=inventory;s.shopRerolls=0;s.shopOpen=true;
    },

    purchase(instanceId){
      const s=this.state;if(s.phase!=="roundEnd"||!s.won||s.victory)return;
      const item=s.shopInventory.find(x=>x.instanceId===instanceId);
      if(!item||s.coins<item.cost)return;
      if(item.kind==="chip"){
        const count=this._ownedCount(item.id);
        if(count&&(!item.stackable||count>=item.maxStack))return;
        if(s.chips.length>=BALANCE.MAX_CHIPS){this.toast(`CHIP SLOTS FULL · ${BALANCE.MAX_CHIPS} MAX`);return;}
        s.chips.push({...item,instanceId:`owned-${item.instanceId}`});
      }else{
        if(s.consumables.length>=BALANCE.MAX_BAG){this.toast(`CONSUMABLE SLOTS FULL · ${BALANCE.MAX_BAG} MAX`);return;}
        s.consumables.push({...item,instanceId:`bag-${item.instanceId}`});
      }
      s.coins-=item.cost;s.shopInventory=s.shopInventory.filter(x=>x.instanceId!==instanceId);
      this.toast(`${item.name.toUpperCase()} ACQUIRED`);this.render();
    },

    rerollShop(){
      const s=this.state;if(s.phase!=="roundEnd"||!s.won||s.victory)return;
      const cost=BALANCE.REROLL_BASE+s.shopRerolls;
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
      if(item.action==="skip"){
        if(inShop){this.toast("USE BLIND SKIP ON A LIVE BLIND");return;}
        if(s.round>=BALANCE.FINAL_BLIND){this.toast("THE FINAL BLIND CANNOT BE SKIPPED");return;}
      }
      s.consumables.splice(index,1);
      if(item.action==="coins"){s.coins+=item.value;this.toast(`+${item.value}¢`);}
      else if(item.action==="skip"){
        s.score=Math.max(s.score,s.target);s.coins+=this._blindPay();
        s.phase="roundEnd";s.won=true;this.generateShop();this.toast("BLIND SKIPPED · SHOP OPEN");
      }
      else if(item.action!=="none"){
        s.pendingBoosts.push({action:item.action,value:item.value});
        this.toast(`${item.name.toUpperCase()} · NEXT HAND`);
      }
      this.evaluateHand();this.render();
    }
  };
})();
