/* Slotchinko bingo cards: five 5x5 cards of feats (one per boss, one for Lou). Design record: docs/slotchinko/BINGO.md.
   A square's full id is "<card>:<key>". On a boss card the two diagonals are that boss's eight rush wins, named after
   the reward each rush already pays (bosses-data.js), Ascension 1 and 2 in the top corners down to 7 and 8 at the
   bottom. The centre square is free. feats.js earns the squares; "tally" squares count across runs and "derive"
   squares are read from the save (overlays.js Prefs). */
(() => {
  "use strict";
  const D=window.SlotchinkoData;
  // Where the rush squares sit (row-major index) for Ascension 1..8.
  const RUSH_AT=[0,4,6,8,16,18,20,24];
  const boss=(id,title,rows)=>{
    const b=D.BOSSES.find(x=>x.id===id), squares=rows.map(([key,name,desc])=>({ key, name, desc }));
    RUSH_AT.forEach((at,i)=>{ squares[at]={ key:`rush${i+1}`, name:b.rewards[i], desc:`Win a rush on ${b.name} at Ascension ${i+1}.`, rush:i+1 }; });
    return { id, boss:id, title, squares };
  };
  const R=["rush","",""], FREE=["free","FREE","A free square. Everybody gets one."];
  const CARDS=[
    boss("sonny","SONNY'S CARD",[
      R,["beat","Shark Bait","Beat Sonny the Shark."],["lose","Chum","Lose to Sonny."],["spare","Hand to Spare","Beat Sonny with a hand left over."],R,
      ["flush","Flush Him Out","Drop a Flush against Sonny."],R,["other","Off the House","Beat Sonny with any deck but the House Deck."],R,["near","Bad Beat","Lose to Sonny within 5% of his target."],
      ["hair","By a Hair","Beat Sonny by 2% of his target or less."],["heart","Bleeding Heart","Drop a heart ball against Sonny and still win."],FREE,["dry","Dry Land","Beat Sonny without dropping a single heart ball."],["deck-glass","Glass Deck","Beat Sonny with the Glass Deck."],
      ["one","One and Done","Beat Sonny with your first hand."],R,["last","The Comeback","Beat Sonny on the last ball of your last hand."],R,["deck-wild-suit","Two-Tone Deck","Beat Sonny with the Two-Tone Deck."],
      R,["double","Double Trouble","Beat Sonny with double his target."],["bare","Bare Knuckle","Beat Sonny owning no Chips."],["deck-owner","Owner's Deck","Beat Sonny with the Owner's Deck."],R
    ]),
    boss("undertow","UNDERTOW'S CARD",[
      R,["beat","Catch the Wave","Beat DJ Undertow."],["lose","Wipeout","Lose to DJ Undertow."],["spare","Hand to Spare","Beat Undertow with a hand left over."],R,
      ["tilt","Shove It","Use a Tilt against Undertow and win."],R,["deck-rubber","Rubber Deck","Beat Undertow with the Rubber Deck."],R,["near","Off Beat","Lose to Undertow within 5% of his target."],
      ["hair","On the Beat","Beat Undertow by 2% of his target or less."],["shores","Both Shores","Against Undertow, land balls in the far-left and far-right pockets in one drop."],FREE,["clubs","Sticky Fingers","Beat Undertow dropping only club hands."],["deck-pachinko","Pachinko Deck","Beat Undertow with the Pachinko Deck."],
      ["one","Drop the Beat","Beat Undertow with your first hand."],R,["hat","Hat Trick","Against Undertow, land three balls in a jackpot in one drop."],R,["centre","Dead Centre","Beat Undertow aiming every ball at the middle pocket."],
      R,["double","Double Time","Beat Undertow with double his target."],["dry","High and Dry","Beat Undertow with no ball in a ×0.5 pocket."],["deck-owner","Owner's Deck","Beat Undertow with the Owner's Deck."],R
    ]),
    boss("mirror","THE MIRROR DEALER'S CARD",[
      R,["beat","Seven Years' Bad Luck","Beat the Mirror Dealer."],["lose","Cracked","Lose to the Mirror Dealer."],["spare","Hand to Spare","Beat the Mirror Dealer with a hand left over."],R,
      ["twopair","Mirror Image","Drop Two Pair against the Mirror Dealer."],R,["deck-ace-high","Ace-High Deck","Beat the Mirror Dealer with the Ace-High Deck."],R,["near","Smoke and Mirrors","Lose to the Mirror Dealer within 5% of his target."],
      ["hair","By a Whisker","Beat the Mirror Dealer by 2% of his target or less."],["unique","One of Each","Beat the Mirror Dealer with no two Chips alike."],FREE,["copy","Copycat","Beat the Mirror Dealer owning three copies of one Chip."],["deck-hoarder","Hoarder Deck","Beat the Mirror Dealer with the Hoarder Deck."],
      ["one","First Glance","Beat the Mirror Dealer with your first hand."],R,["last","Last Look","Beat the Mirror Dealer on the last ball of your last hand."],R,["fourkind","Four of a Kind","Drop Four of a Kind against the Mirror Dealer."],
      R,["double","Seeing Double","Beat the Mirror Dealer with double his target."],["light","Packed Light","Beat the Mirror Dealer with four Chips or fewer."],["deck-owner","Owner's Deck","Beat the Mirror Dealer with the Owner's Deck."],R
    ]),
    boss("house","THE HOUSE'S CARD",[
      R,["beat","House Money","Beat The House."],["lose","House Wins","Lose to The House."],["spare","Hand to Spare","Beat The House with a hand left over."],R,
      ["fullhouse","A Better House","Drop a Full House against The House."],R,["deck-mint","Mint Deck","Beat The House with the Mint Deck."],R,["near","So Close","Lose to The House within 5% of its target."],
      ["hair","Photo Finish","Beat The House by 2% of its target or less."],["bank","Break the Bank","Beat The House with every shield broken."],FREE,["whale","Whale Watching","Beat The House with a Whale set."],["deck-house","Home Game","Beat The House with the House Deck."],
      ["one","Check, Please","Beat The House with your first hand."],R,["cash","Cash Out","Beat The House with 50¢ unspent."],R,["noshield","Walk-In","Beat The House without breaking a shield."],
      R,["double","Twice the House","Beat The House with double its target."],["whales","Two Whales","Beat The House with two Whale sets."],["deck-owner","Owner's Deck","Beat The House with the Owner's Deck."],R
    ]),
    { id:"lou", boss:null, title:"LOU'S CARD", squares:[
      ["table","Table Stakes","Finish a run, win or lose."],["vip","VIP Pass","Reach a VIP set."],["window","Window Shopper","Leave a shop without buying anything."],["karma","Good Karma","Hand in the Lost Wallet."],["lounge","Lounge Lizard","Visit the Lounge three times in one run."],
      ["ballpit","Ball Pit","Drop 12 balls in one hand."],["luck","Lucky Break","Win a run."],["spender","Big Spender","Reroll five times in one shop."],["rushhour","Rush Hour","Win two rushes in one run."],["royal","Royal Flush","Drop a Royal Flush."],
      ["streak","Lucky Streak","Win the Croupier's Wager three times.",{ tally:"wager", need:3 }],["sweep","Clean Sweep","Land a ball in every pocket in one drop."],FREE,["rainbow","Rainbow","Clear a blind with three hands in three different suits."],["top","Top Floor","Win a run at Ascension 8."],
      ["whale","Whale","Reach a Whale set."],["nothing","Nothing Personal","Lose a rush with nothing for Lou to take."],["elite","Elite Company","Clear three Elite blinds in one run."],["oneball","One Ball","Clear a blind with the first ball you drop."],["fulldeck","Full Deck","Win a run with every deck.",{ derive:"fulldeck" }],
      ["penny","Penny Pincher","Win a run without rerolling."],["four","Four for Four","Win all four rushes in one run."],["regular","Lou's Regular","Lose ten rushes.",{ tally:"rushLost", need:10 }],["six","Six Figures","Score 100,000 in one run."],["comped","Comped for Life","Black out all four boss cards.",{ derive:"comped" }]
    ].map(([key,name,desc,more])=>({ key, name, desc, ...more })) }
  ];
  for(const c of CARDS) c.squares.forEach(q=>{ q.id=`${c.id}:${q.key}`; });
  const rows=[0,1,2,3,4].map(r=>[0,1,2,3,4].map(c=>r*5+c)), cols=[0,1,2,3,4].map(c=>[0,1,2,3,4].map(r=>r*5+c));
  /* Prizes. A line pays once it is finished, and the save works out what is owned from the card itself, so nothing
     is "claimed". On a boss card the middle row (line 2) and the N column (line 7), the two lines that need no rush,
     open something to play with; the other ten pay a title to wear. A blackout pays a felt for the board, and Lou's
     pays his deck. unlock: the id in UNLOCKS that the line opens (pushed below). */
  const title=name=>({ kind:"title", name });
  const open=(id,name,what,note)=>({ kind:"unlock", id, name, what, note });
  const felt=(id,name)=>({ kind:"felt", id, name:`${name} felt` });
  // Titles in line order: five rows, five columns, the two diagonals. null where the line opens something instead.
  const PRIZES={
    sonny:{ titles:["Minnow","Bait Thief",null,"Card Shark","Shark Hunter","Sharp Dresser","Bloodhound",null,"Deep Diver","Fin Collector","Great White","Sonny's Nemesis"],
      2:open("stripped-deck","Stripped Deck","Deck card","Now turns up in the shop."), 7:open("last-call","Last Call","Chip","Now turns up in the shop."), blackout:felt("sharkskin","Sharkskin") },
    undertow:{ titles:["Wave Rider","Beat Keeper",null,"Tide Turner","Headliner","Crowd Surfer","Deckhand",null,"Rip Current","Bass Dropper","Opening Act","King Tide"],
      2:open("board-shores","Two Shores","Board","A board with a jackpot at each edge joins the rotation."), 7:open("life-ring","Life Ring","Bag item","Now turns up in the shop."), blackout:felt("neon-tide","Neon Tide") },
    mirror:{ titles:["Fair Reflection","Double Agent",null,"Looking Sharp","Glass Breaker","Second Glance","Copy Editor",null,"Mirror Master","One of a Kind","Seven Lucky Years","The Other Dealer"],
      2:open("double-take","Double Take","Bag item","Now turns up in the shop."), 7:open("minimalist","Minimalist","Chip","Now turns up in the shop."), blackout:felt("chrome","Chrome") },
    house:{ titles:["Table Regular","Big Fish",null,"Pit Favourite","Bank Breaker","House Guest","Comped",null,"Shield Breaker","Key Holder","The Better House","Owner"],
      2:open("back-room","The Back Room","Event","Lou may now offer it on the path."), 7:open("compound-interest","Compound Interest","Chip","Now turns up in the shop."), blackout:felt("gold","Gold") },
    lou:{ titles:["New Face","Lou's Pal","Good Customer","Trouble","Lou's Favourite","Lucky","Rush Addict","Night Owl","Silver Tongue","Legend","Kid","House Rules"],
      blackout:open("dealer","Dealer's Deck","Deck","Pick it when you choose your deck.") }
  };
  const WHO={ sonny:"Sonny's", undertow:"Undertow's", mirror:"the Mirror Dealer's", house:"The House's", lou:"Lou's" };
  const KIND={ "Deck card":"item", Chip:"item", "Bag item":"item", Board:"board", Event:"event", Deck:"deck" };
  for(const c of CARDS){
    const p=PRIZES[c.id];
    c.prizes=p.titles.map((t,i)=>p[i]||title(t));
    c.blackout=p.blackout;
    [...c.prizes.map((z,line)=>[z,line]),[c.blackout,"blackout"]].forEach(([z,line])=>{
      if(z.kind!=="unlock") return;
      const who=WHO[c.id], where=line==="blackout"?`Black out ${who} bingo card.`:`Bingo: finish the ${line===2?"middle row":"N column"} of ${who} card.`;
      D.UNLOCKS.push({ kind:KIND[z.what], id:z.id, bingo:{ card:c.id, line }, hint:where, test:()=>false });
    });
  }
  D.BINGO={
    CARDS,
    FELTS:CARDS.map(c=>c.blackout).filter(z=>z.kind==="felt"),
    FREE:12,
    // Numbers the feats are judged by (feats.js).
    NEAR_LOSS:0.95, NEAR_WIN:1.02, DOUBLE:2, CASH:50, BALL_PIT:12, REROLLS:5, LOUNGES:3, ELITES:3, SIX_FIGURES:100000, LIGHT_CHIPS:4, COPIES:3, HAT_TRICK:3,
    // The twelve lines of a card, as square indexes.
    LINES:[
      ...rows.map((at,i)=>({ name:["TOP ROW","SECOND ROW","MIDDLE ROW","FOURTH ROW","BOTTOM ROW"][i], at })),
      ...cols.map((at,i)=>({ name:`${"BINGO"[i]} COLUMN`, at })),
      { name:"DIAGONAL DOWN", at:[0,6,12,18,24] },{ name:"DIAGONAL UP", at:[20,16,12,8,4] }
    ],
    square:id=>{ for(const c of CARDS){ const q=c.squares.find(x=>x.id===id); if(q) return { card:c, square:q }; } return null; }
  };
})();
