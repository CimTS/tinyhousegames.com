/* Games section for tinyhousegames.com.
   Data lives in games.json. The list is also written into index.html by
   tools/prerender-games.mjs, so it is there without JavaScript (for search
   engines and link previews). After editing games.json, run that tool.
   renderGames() is pure and DOM-only (no innerHTML from data). */

const EMPTY_MESSAGE =
  'Coming soon. Small games are being tinkered with in the tiny house — check back shortly.';

const hasText = (value) => typeof value === 'string' && value.trim() !== '';
const safeUrl = (u) => hasText(u) && !/^\s*(javascript|data|vbscript):/i.test(u);

/* The entries that get a card: a title is required, and a link must be safe. */
export function visibleGames(list) {
  return (Array.isArray(list) ? list : []).filter(
    (game) => game && typeof game === 'object' && hasText(game.title) && (game.url === undefined || game.url === '' || safeUrl(game.url))
  );
}

export function renderGames(list, doc = globalThis.document) {
  const root = doc && doc.getElementById('games-list');
  if (!root) return null;

  root.textContent = '';

  const games = visibleGames(list);

  if (games.length === 0) {
    const message = doc.createElement('p');
    message.className = 'games-empty';
    message.textContent = EMPTY_MESSAGE;
    root.append(message);
    return root;
  }

  const fragment = doc.createDocumentFragment();

  for (const game of games) {
    const card = doc.createElement('article');
    card.className = 'game-card';

    if (hasText(game.image)) {
      const img = doc.createElement('img');
      img.className = 'game-card__img';
      img.src = game.image;
      img.alt = game.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      card.append(img);
    } else {
      const tile = doc.createElement('div');
      tile.className = 'game-card__tile';
      tile.textContent = 'coming soon ✨';
      card.append(tile);
    }

    const title = doc.createElement('h3');
    title.className = 'game-card__title';
    title.textContent = game.title;
    card.append(title);

    if (hasText(game.blurb)) {
      const blurb = doc.createElement('p');
      blurb.className = 'game-card__blurb';
      blurb.textContent = game.blurb;
      card.append(blurb);
    }

    const url = hasText(game.url) ? game.url.trim() : '';
    if (url && url !== '#') {
      const link = doc.createElement('a');
      link.className = 'game-card__link pill';
      link.href = url;
      link.textContent = hasText(game.cta) ? game.cta : 'Play';
      if (/^(https?:)?\/\//i.test(url)) link.rel = 'noopener';
      card.append(link);
    }

    fragment.append(card);
  }

  root.append(fragment);
  return root;
}

export async function loadGames(url = 'games.json') {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // The cards are normally already in the page. Fetch and draw them only if they are missing.
  const start = () => {
    if (document.querySelector('#games-list .game-card')) return;
    return loadGames().then((list) => renderGames(list, document));
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
