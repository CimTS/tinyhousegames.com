/* Slotchinko boss art: hand-drawn neon signs. Stroke only, one width, round ends, glow comes from CSS (.boss-art).
   Colours are from the game palette; white and icy blue are the two the boss designs call for by name. */
(() => {
  "use strict";
  const CYAN="#36F5E5",PINK="#FF4FA3",VIOLET="#A78BFA",GOLD="#FFD166",WHITE="#FFFFFF",ICE="#BFEFFF";
  const sign=(...groups)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${groups.map(([c,d])=>`<g stroke="${c}">${d}</g>`).join("")}</svg>`;
  const p=d=>`<path d="${d}"/>`;

  window.SlotchinkoBossArt={
    sonny:sign(
      [CYAN,p("M14 30 C28 16 46 13 62 19 L74 5 L76 26 C82 32 84 42 84 52")+p("M14 30 L34 41 C38 47 40 50 40 54")+p("M21 33 l5 5 l4 -3 l5 5 l3 -3")+'<circle cx="36" cy="26" r="2"/>'+p("M57 30 v9 M64 31 v9 M71 33 v9")],
      [WHITE,p("M36 56 H88 L92 76 H34 Z")+p("M62 56 L54 66 L62 76 L70 66 Z")+p("M36 58 L16 68 L12 62")+p("M4 58 H26")+'<circle cx="9" cy="53" r="4"/><circle cx="21" cy="53" r="4"/>'+p("M13 53 h4")],
      [PINK,p("M38 78 L34 104 H50 L60 84 L70 104 H86 L88 78")+p("M34 104 L30 114 H16 M50 104 V114 H30")+p("M70 104 V114 H98 L86 104")]
    ),
    undertow:sign(
      [CYAN,p("M28 46 C28 22 46 12 60 12 C74 12 92 22 92 46 C80 52 70 48 60 52 C50 48 40 52 28 46 Z")+'<circle cx="50" cy="34" r="2"/><circle cx="70" cy="34" r="2"/>'+p("M52 41 q8 6 16 0")],
      [VIOLET,p("M42 54 C36 64 48 70 42 82")+p("M54 56 C50 66 60 72 54 84")+p("M66 56 C70 66 60 72 66 84")+p("M78 54 C84 64 72 70 78 82")],
      [PINK,p("M20 44 C20 12 100 12 100 44")+'<rect x="14" y="40" width="12" height="20" rx="5"/><rect x="94" y="40" width="12" height="20" rx="5"/>'+'<circle cx="24" cy="102" r="13"/><circle cx="24" cy="102" r="3"/><circle cx="96" cy="102" r="13"/><circle cx="96" cy="102" r="3"/>'+p("M40 112 H80")]
    ),
    mirror:sign(
      [VIOLET,'<rect x="36" y="8" width="48" height="104" rx="6"/>'+p("M36 60 H84")],
      [ICE,p("M60 16 L74 34 L60 52 L46 34 Z")+'<circle cx="60" cy="34" r="3"/>'+p("M60 68 L74 86 L60 104 L46 86 Z")+'<circle cx="60" cy="86" r="3"/>'],
      [WHITE,p("M36 50 L24 56 L10 48")+'<rect x="4" y="22" width="16" height="24" rx="3"/>'+p("M84 70 L96 64 L110 72")+'<rect x="100" y="74" width="16" height="24" rx="3"/>']
    ),
    house:sign(
      [GOLD,'<rect x="26" y="46" width="68" height="68" rx="7"/>'+p("M26 46 L18 24 L42 35 L60 21 L78 35 L102 24 L94 46")+p("M52 114 V98 Q60 88 68 98 V114")],
      [CYAN,p("M30 3 l6 7 l-6 7 l-6 -7 Z")+p("M60 2 l6 7 l-6 7 l-6 -7 Z")+p("M90 3 l6 7 l-6 7 l-6 -7 Z")],
      [PINK,p("M44 62 C40 56 34 60 36 65 L44 74 L52 65 C54 60 48 56 44 62 Z")+p("M76 56 L84 66 L76 76 L68 66 Z")]
    )
  };
})();
