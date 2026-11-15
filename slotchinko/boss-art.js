/* Slotchinko boss art: hand-drawn neon signs. Stroke only, one width, round ends, glow comes from CSS (.boss-art).
   Colours are from the game palette; white and icy blue are the two the boss designs call for by name. */
(() => {
  "use strict";
  const CYAN="#36F5E5",PINK="#FF4FA3",VIOLET="#A78BFA",GOLD="#FFD166",WHITE="#FFFFFF",ICE="#BFEFFF";
  const sign=(...groups)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${groups.map(([c,d])=>`<g stroke="${c}">${d}</g>`).join("")}</svg>`;
  const p=d=>`<path d="${d}"/>`;

  window.SlotchinkoBossArt={
    /* Sonny the Shark: side on, long snout and a grin, in a white dinner jacket and a pink bow tie. */
    sonny:sign(
      [CYAN,p("M10 48 C26 32 46 24 62 24 L72 5 C74 15 79 23 86 29 C92 38 93 58 90 82")+p("M10 48 C18 54 26 57 34 58 H60 C54 66 46 68 38 67 C46 75 54 80 62 84")+p("M38 35 L50 37")+'<circle cx="46" cy="43" r="2.5"/>'+p("M68 46 q-3 7 0 14 M75 46 q-3 7 0 14 M82 46 q-3 7 0 14")],
      [WHITE,p("M36 58 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5")+p("M22 116 C26 105 42 100 56 96 L75 116 L94 96 C101 99 108 106 110 116")],
      [PINK,p("M71 92 L60 86 V98 Z")+p("M79 92 L90 86 V98 Z")+'<circle cx="75" cy="92" r="3.5"/>']
    ),
    /* DJ Undertow: a jellyfish in headphones. The bell is the head, the tentacles keep time. */
    undertow:sign(
      [CYAN,p("M30 58 C30 32 44 20 60 20 C76 20 90 32 90 58 Q82.5 67 75 58 Q67.5 67 60 58 Q52.5 67 45 58 Q37.5 67 30 58 Z")+p("M44 42 q5 -6 10 0 M66 42 q5 -6 10 0")+p("M52 49 q8 6 16 0")],
      [VIOLET,p("M38 72 q-6 7 0 14 q6 7 0 14 q-6 7 0 14")+p("M53 74 q-6 7 0 14 q6 7 0 14 q-6 7 0 14")+p("M67 74 q6 7 0 14 q-6 7 0 14 q6 7 0 14")+p("M82 72 q6 7 0 14 q-6 7 0 14 q6 7 0 14")],
      [PINK,p("M20 48 C20 20 40 8 60 8 C80 8 100 20 100 48")+'<rect x="12" y="44" width="14" height="24" rx="6"/><rect x="94" y="44" width="14" height="24" rx="6"/>']
    ),
    /* The Mirror Dealer: a hand mirror with a poker face, bow tie knotted where the handle starts. */
    mirror:sign(
      [VIOLET,'<ellipse cx="60" cy="40" rx="28" ry="31"/>'+p("M55 86 L54 104 Q60 114 66 104 L65 86")],
      [ICE,'<ellipse cx="60" cy="40" rx="20" ry="23"/>'+p("M51 32 L55 38 L51 44 L47 38 Z")+p("M69 32 L73 38 L69 44 L65 38 Z")+p("M55 52 H65")],
      [WHITE,p("M56 79 L45 72 V86 Z")+p("M64 79 L75 72 V86 Z")+'<circle cx="60" cy="79" r="3.5"/>']
    ),
    /* Lou the Dealer: a smiling man in a fedora. He talks a new player through the first round (coach.js). */
    host:sign(
      [GOLD,p("M10 50 Q60 34 110 50")+p("M32 42 C30 20 44 12 60 17 C76 12 90 20 88 42")+p("M52 16 q8 7 16 0")+p("M32 37 Q60 29 88 37")],
      [WHITE,p("M38 52 C37 76 49 90 60 90 C71 90 83 76 82 52")+p("M46 62 q5 -6 10 0")+p("M64 62 q5 -6 10 0")+p("M47 72 Q60 86 73 72")],
      [CYAN,p("M16 116 C18 102 34 98 47 93 L60 101 L73 93 C86 98 102 102 104 116")+p("M60 101 l-5 7 l5 8 l5 -8 Z")]
    ),
    /* THE HOUSE: a house with a crown on. Card-suit windows for eyes, the door for a mouth. */
    house:sign(
      [GOLD,p("M14 64 L60 34 L106 64")+p("M26 56 V114 H94 V56")+p("M52 114 V100 Q60 90 68 100 V114")],
      [CYAN,p("M41 30 L36 9 L49 19 L60 5 L71 19 L84 9 L79 30 Z")],
      [PINK,p("M43 76 C39 70 33 74 35 79 L43 88 L51 79 C53 74 47 70 43 76 Z")+p("M77 70 L85 80 L77 90 L69 80 Z")]
    )
  };
})();
