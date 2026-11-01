/* Aim phase: Drop Hand (or touching the board) only starts aiming; the same button, now DROP, releases the balls. */
(() => {
  "use strict";
  function create(game){
    let on=false;
    const f={
      sync(){if(game.state.phase!=="slot")on=false;return on;},
      get aiming(){return f.sync();},
      press(){if(game.state.phase!=="slot")return false;if(!on){on=true;return false;}on=false;game.startDrop();return true;},
      boardRelease(){if(game.state.phase==="slot")on=true;},
    };
    return f;
  }
  window.SlotchinkoAimFlow={create};
})();
