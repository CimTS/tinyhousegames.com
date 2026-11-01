/* Slotchinko run manager: hands, drops, blinds. Logic only; everything on screen
   goes through this.view (null in the test harness). sound.js wraps these methods. */
(() => {
  "use strict";
  const {SUITS,BALANCE}=window.SlotchinkoData;
  const {createDeck,evaluatePokerHand}=window.SlotchinkoPoker;
  const BALL_GAP_STEPS=20, FINISH_DELAY_STEPS=27;

  class SlotchinkoGame {
    constructor({view=null,seed=null}={}){
      this.view=view;
      this.rng=new window.SlotchinkoRNG.SeededRandom(seed);
      this.timers=[];this.stepCount=0;
      this.physics=new window.PlinkoPhysics({
        onPegHit:(ball,peg)=>this.onPegHit(ball,peg),
        onBallSpawn:({reason})=>{if(reason==="split")this.state.activeBalls++;},
        onPegDestroyed:({element})=>this.onPegDestroyed(element),
        onObstacleHit:()=>this.vibrate(4),
        onBucket:result=>this.onBucket(result)
      },()=>this.rng.random("physics"));
      this.newRun(seed);
    }

    newRun(seed=this.rng.seed){
      this.rng.reset(seed);this.timers=[];
      this.state={
        phase:"slot", round:1, score:0, target:BALANCE.BLIND_TARGETS[0], coins:BALANCE.START_COINS, roundScore:0,
        spins:0, maxSpins:2, deck:[], discardPile:[], cards:[],
        reels:[], held:[false,false,false,false,false],
        hand:"High Card", handDetail:"", power:1, balls:1,
        ballsLeft:0, chips:[], consumables:[], pendingBoosts:[],
        shopInventory:[], shopRerolls:0, shopOpen:false, aim:0.5,
        activeBalls:0, won:false, glassCharge:true, primarySuit:"heart",
        lastEvaluation:null, diamondHits:0, coinsEarnedThisBlind:0, activeBoosts:[],
        victory:false, targetHit:false, glassLeft:0, glassBoost:0, finishing:false
      };
      this.physics.setRound(1);
      this._startNewHand();
      this.render();
    }

    /* One fixed 60 Hz tick. All gameplay timing counts ticks, so seeds replay exactly. */
    step(){
      if(this.state.phase!=="drop")return;
      this.physics.step();this.stepCount++;
      const due=this.timers.filter(t=>t.at<=this.stepCount);
      if(due.length){this.timers=this.timers.filter(t=>t.at>this.stepCount);due.forEach(t=>t.fn());}
      const s=this.state;
      if(s.phase==="drop"&&!s.finishing&&s.ballsLeft===0&&this.physics.balls.size===0){
        s.finishing=true;s.activeBalls=0;this.after(FINISH_DELAY_STEPS,()=>this.finishRound());
      }
    }
    after(steps,fn){this.timers.push({at:this.stepCount+steps,fn});}

    _drawCard(){return this.state.deck.pop()||null;}

    _startNewHand(){
      const s=this.state;s.deck=createDeck(this.rng.stream("deck"));s.discardPile=[];
      s.cards=Array.from({length:5},()=>this._drawCard());
      s.held=[false,false,false,false,false];s.spins=0;s.lastEvaluation=null;
      this.evaluateHand();
    }

    toggleHold(index){
      const s=this.state;
      if(s.phase!=="slot"||!Number.isInteger(index)||index<0||index>4)return;
      s.held[index]=!s.held[index];this.vibrate(8);this.render();
    }

    spin(){
      const s=this.state;if(s.phase!=="slot"||s.spins>=s.maxSpins)return;
      if(s.held.every(Boolean)){this.toast("ALL CARDS HELD · RELEASE ONE TO DRAW");return;}
      const replaced=[];
      s.cards=s.cards.map((card,i)=>{
        if(s.held[i])return card;if(card)s.discardPile.push(card);
        const next=this._drawCard();if(next)replaced.push(i);return next||card;
      });
      s.spins++;this.evaluateHand();this.render();
      this.view?.dealt(replaced);
      this.toast(s.spins===s.maxSpins?"FINAL DRAW USED":"CARDS REDRAWN");this.vibrate(18);
    }

    _ownedCount(id){return this.state.chips.filter(c=>c.id===id).length;}

    evaluateHand(){
      const s=this.state;if(s.cards.length!==5||s.cards.some(c=>!c))return;
      const result=evaluatePokerHand(s.cards),fx=this._effects();
      s.lastEvaluation=result;s.hand=result.name;
      s.handDetail=`${result.description} · ${result.bonus}`;
      s.power=result.power*(1+this._boost(s.pendingBoosts,"power"));
      s.balls=Math.min(BALANCE.MAX_HAND_BALLS,result.balls+fx.extraBalls+this._boost(s.pendingBoosts,"balls"));
      s.primarySuit=this._dominantSuit();
      return result;
    }

    _boost(list,action){return list.reduce((sum,b)=>sum+(b.action===action?b.value:0),0);}

    _dominantSuit(){
      const counts={heart:0,spade:0,diamond:0,club:0};this.state.cards.forEach(c=>counts[c.suit]++);
      return SUITS.reduce((best,suit)=>counts[suit]>counts[best]?suit:best,SUITS[0]);
    }

    startDrop(){
      const s=this.state;if(s.phase!=="slot")return;
      this.evaluateHand();
      s.activeBoosts=[...s.pendingBoosts];
      s.pendingBoosts=[];
      s.phase="drop";s.ballsLeft=s.balls;s.activeBalls=0;s.finishing=false;
      s.roundScore=0;s.diamondHits=0;
      s.glassLeft=this._effects().glass;s.glassBoost=this._boost(s.activeBoosts,"glass");
      this.render();this.view?.dropStarted();
      this.toast(`${s.hand.toUpperCase()} — ${s.balls} BALL${s.balls===1?"":"S"}`);
      this._dropNext();
    }

    _dropNext(){
      const s=this.state;if(s.phase!=="drop"||s.ballsLeft<=0)return;
      // A full board waits for room, so no ball of the hand is ever lost.
      if(this.physics.balls.size>=window.PlinkoPhysics.MAX_BALLS){this.after(BALL_GAP_STEPS,()=>this._dropNext());return;}
      const fx=this._effects();
      const spread=(this.rng.random("launch")-.5)*fx.launchSpread*this.physics.width;
      s.ballsLeft--;s.activeBalls++;
      this.physics.drop(this._ballOptions(24+s.aim*(this.physics.width-48)+spread,fx));
      this.render();this.after(BALL_GAP_STEPS,()=>this._dropNext());
    }

    /* A ball's suits are the hand's main suit, or all four under Wild Current. */
    _ballOptions(x,fx){
      const s=this.state,wild=s.activeBoosts.some(b=>b.action==="rainbow");
      const suits=wild?[...SUITS]:[s.primarySuit],has=suit=>suits.includes(suit);
      return {
        x,element:s.primarySuit,suits,heavy:has("spade"),fortune:has("diamond"),sticky:has("club"),
        damage:has("spade")?2+fx.spadeDamage:1,
        splitsLeft:has("heart")?1+fx.reactor:0,splitAt:fx.reactor?1:BALANCE.HEART_SPLIT_HIT,chain:fx.splitChain>0,
        wellPull:1+fx.wellPull+(has("spade")?fx.spadeWell:0),plating:fx.plating,stick:fx.stickPower
      };
    }

    onPegHit(ball,peg){
      const s=this.state;this.vibrate(5);
      const p=ball&&ball.plugin;if(!p)return;
      if(!p.glass&&(s.glassLeft>0||s.glassBoost>0)){
        p.glass=(s.glassLeft>0?BALANCE.GLASS_MULT:1)*(s.glassBoost||1);
        s.glassLeft=Math.max(0,s.glassLeft-1);s.glassBoost=0;
      }
      if(p.suits&&p.suits.includes("diamond")){
        const fx=this._effects();s.diamondHits++;
        if(fx.diamondBonus&&s.diamondHits%3===0){
          const bonus=BALANCE.DIAMOND_BONUS*fx.diamondBonus;
          s.roundScore+=bonus;s.score+=bonus;this.toast(`DIAMOND CHARGE +${bonus}`);
        }
      }
    }

    onPegDestroyed(){this.vibrate(8);}

    onBucket(result){
      const s=this.state,fx=this._effects(),ball=result.ball;
      const gained=this.ballScore(result,fx);
      s.roundScore+=gained;s.score+=gained;
      s.activeBalls=Math.max(0,s.activeBalls-1);
      const p=ball?ball.plugin:{};
      if(fx.clubCoins&&!result.drained&&p.suits?.includes("club")&&p.pegHits>=BALANCE.CLUB_COIN_HITS){
        s.coins+=fx.clubCoins;this.toast("CLUB KING +1¢");
      }
      if(fx.pressCoins>0){
        const earned=Math.min(BALANCE.PRESS_CAP,Math.floor(s.roundScore/BALANCE.PRESS_STEP))*fx.pressCoins;
        if(earned>s.coinsEarnedThisBlind){s.coins+=earned-s.coinsEarnedThisBlind;s.coinsEarnedThisBlind=earned;}
      }
      if(!s.targetHit&&s.score>=s.target){s.targetHit=true;this.view?.targetHit();}
      this.view?.ballScored(result,gained);
      this.vibrate([12,25,12]);this.render();
    }

    _blindPay(fx=this._effects()){return BALANCE.BLIND_PAY+Math.floor(this.state.round/2)+fx.coinsPerBlind;}

    finishRound(){
      const s=this.state;if(s.phase!=="drop")return;s.phase="roundEnd";
      if(s.score>=s.target){
        s.won=true;
        if(s.round>=BALANCE.FINAL_BLIND){s.victory=true;s.shopInventory=[];this.toast("FINAL BLIND BEATEN");}
        else{s.coins+=this._blindPay();this.generateShop();this.toast("BLIND CLEARED · SHOP OPEN");}
      }else{s.won=false;s.shopInventory=[];this.toast("BLIND FAILED · RUN ENDED");}
      this.render();
      if(s.victory||!s.won)this.view?.runEnded();
    }

    nextRound(){
      const s=this.state;if(s.phase!=="roundEnd"||!s.won||s.victory)return;
      s.round++;s.target=BALANCE.BLIND_TARGETS[s.round-1];
      s.phase="slot";s.won=false;s.shopOpen=false;s.shopInventory=[];s.targetHit=s.score>=s.target;
      s.coinsEarnedThisBlind=0;s.activeBoosts=[];this.physics.setRound(s.round);
      this._startNewHand();this.render();
    }

    render(){this.view?.render(this);}
    toast(message){this.view?.toast(message);}
    vibrate(pattern){this.view?.vibrate(pattern);}
  }

  Object.assign(SlotchinkoGame.prototype,window.SlotchinkoScoring,window.SlotchinkoShopLogic);
  window.SlotchinkoGame=SlotchinkoGame;
  window.SlotchinkoShop={CHIP_CATALOG:window.SlotchinkoData.CHIP_CATALOG,CONSUMABLE_CATALOG:window.SlotchinkoData.CONSUMABLE_CATALOG};
})();
