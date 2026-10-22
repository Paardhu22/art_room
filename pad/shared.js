// Shared by the phone pad and the Art Grid: pairing codes and the WebSocket link.
// (Ink colours and pen sizes come from the Art Grid itself; it sends them to the phone.)
(() => {
  'use strict';

  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function randomCode(length, chars = ROOM_CHARS) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return [...bytes].map(b => chars[b % chars.length]).join('');
  }

  // A WebSocket to the relay that keeps reconnecting. Messages sent while the link is down
  // wait in a queue, so strokes drawn during a short drop still arrive, in order.
  function connect({ role, room, id, onMessage, onState }) {
    let ws = null;
    let retry = 0;
    let timer = 0;
    let stopped = false;
    const queue = [];
    const params = new URLSearchParams({ room, role });
    if (id) params.set('id', id);
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/pad-link?${params}`;

    function open() {
      clearTimeout(timer);
      if (stopped || (ws && ws.readyState <= 1)) return;
      onState('connecting');
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry = 0;
        onState('open');
        while (queue.length && ws.readyState === 1) ws.send(queue.shift());
      };
      ws.onmessage = e => {
        let msg;
        try { msg = JSON.parse(e.data); } catch (_) { return; }
        if (msg && typeof msg.t === 'string') onMessage(msg);
      };
      ws.onclose = () => {
        onState('closed');
        if (!stopped) timer = setTimeout(open, Math.min(4000, 250 * 2 ** retry++));
      };
    }

    // Phones freeze background tabs; reconnect the moment the page is back.
    const wake = () => { if (document.visibilityState === 'visible') { retry = 0; open(); } };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    open();

    return {
      // `keep` = false for messages that are only useful right now (hover, pings).
      send(msg, keep = true) {
        const text = JSON.stringify(msg);
        if (ws && ws.readyState === 1) { ws.send(text); return true; }
        if (keep && queue.length < 20000) queue.push(text);
        return false;
      },
      get open() { return !!ws && ws.readyState === 1; },
      stop() {
        stopped = true;
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', wake);
        window.removeEventListener('online', wake);
        if (ws) ws.close();
      }
    };
  }

  window.PadShared = { ROOM_CHARS, randomCode, connect };
})();
