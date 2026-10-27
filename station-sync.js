/* Bethesda R10: durable per-operation outbox, compatible with older WebViews. */
(function (root) {
  'use strict';
  function uid() {
    var c = root.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    if (c && typeof c.getRandomValues === 'function') {
      var a = new Uint8Array(16); c.getRandomValues(a);
      a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
      return Array.from(a, function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
    }
    // This is a request identifier, never an authentication credential.
    return 'op-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }
  async function request(url, payload, timeout) {
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var timer;
    try {
      return await Promise.race([
        (async function () {
          var options = { method: payload ? 'POST' : 'GET', cache: 'no-store' };
          if (controller) options.signal = controller.signal;
          // A simple CORS request avoids an extra preflight on unreliable camp Wi-Fi.
          if (payload) { options.headers = { 'Content-Type': 'text/plain;charset=UTF-8' }; options.body = JSON.stringify(payload); }
          var response = await root.fetch(url, options);
          var data;
          try { data = await response.json(); } catch (_) { throw new Error('伺服器回覆未能讀取，結果尚未確認。'); }
          return { status: response.status, data: data };
        })(),
        new Promise(function (_, reject) { timer = setTimeout(function () {
          if (controller) controller.abort();
          reject(new Error('連線逾時，結果尚未確認。'));
        }, timeout || 15000); })
      ]);
    } finally { clearTimeout(timer); }
  }
  function Outbox(options) {
    this.storage = options.storage; this.send = options.send;
    this.changed = options.changed || function () {}; this.notify = options.notify || function () {};
    this.now = options.now || Date.now; this.prefix = 'bethesda_station_R10:' + options.station + ':';
    this.busy = false;
  }
  Outbox.prototype.list = function () {
    var entries = [];
    for (var i = 0; i < this.storage.length; i++) {
      var key = this.storage.key(i);
      if (key && key.indexOf(this.prefix) === 0) {
        try {
          var value = JSON.parse(this.storage.getItem(key));
          if (!value || !value.key || !value.payload) throw new Error('invalid');
          entries.push(value);
        } catch (_) { throw new Error('此裝置有損壞的待處理紀錄。請匯出診斷並由主持人核對，勿清除瀏覽資料。'); }
      }
    }
    return entries.sort(function (a, b) { return a.created - b.created || a.key.localeCompare(b.key); });
  };
  Outbox.prototype.save = function (item) {
    var key = this.prefix + item.key;
    var text = JSON.stringify(item);
    try {
      this.storage.setItem(key, text);
      if (this.storage.getItem(key) !== text) throw new Error('not persisted');
    } catch (_) { throw new Error('瀏覽器未能保存入分紀錄。請保留此頁並匯出紀錄，勿清除瀏覽資料；未確認儲存前不會送出新入分。'); }
    this.changed(); return item;
  };
  Outbox.prototype.add = function (payload, extras) {
    var existing = this.list().find(function (x) { return payload.operationId && x.payload.operationId === payload.operationId; });
    if (existing) return existing;
    return this.save(Object.assign({ key: payload.operationId || uid(), payload: payload,
      created: this.now(), status: payload.operationId ? 'pending' : 'review', attempts: 0, nextAt: 0, error: '' }, extras || {}));
  };
  Outbox.prototype.update = function (key, patch) {
    var raw = this.storage.getItem(this.prefix + key);
    if (!raw) throw new Error('原操作紀錄不存在，請主持人核對。');
    var item = JSON.parse(raw);
    // Another tab may already have received success. Never regress that receipt.
    if (item.status === 'succeeded' || item.status === 'reviewed') return item;
    return this.save(Object.assign(item, patch));
  };
  Outbox.prototype.migrate = function () {
    var self = this;
    ['bethesda_queue_A1', 'bethesda_queue_R82_' + this.prefix.split(':')[1]].forEach(function (key) {
      var text = self.storage.getItem(key); if (!text) return;
      var old;
      try { old = JSON.parse(text); if (!Array.isArray(old)) throw new Error('invalid'); }
      catch (_) { throw new Error('舊版待處理紀錄損壞，請主持人核對；原紀錄已保留。'); }
      old.forEach(function (x, i) {
        if (!x.payload || x.payload.station !== self.prefix.split(':')[1]) return;
        var stable = x.payload.operationId || 'legacy-' + key + '-' + i;
        if (!self.storage.getItem(self.prefix + stable)) self.add(x.payload, { key: stable, status: x.payload.operationId ? 'retry' : 'review', error: '從舊版保留的未確認操作，請以原編號重試。' });
      });
    });
    // Originals remain intact for audit. The new transport ignores migrated arrays.
  };
  Outbox.prototype.flush = async function (force) {
    if (this.busy) return; this.busy = true;
    try {
      var candidates = this.list().filter(function (x) { return ['pending','sending','retry'].indexOf(x.status) >= 0; });
      for (var original of candidates) {
        var item = this.list().find(function (x) { return x.key === original.key; });
        if (!item || ['succeeded','rejected','reviewed','review'].indexOf(item.status) >= 0 || (!force && item.nextAt > this.now())) continue;
        item = this.update(item.key, { status: 'sending', attempts: (item.attempts || 0) + 1, error: '正在傳送，等待伺服器確認。' });
        var response;
        try { response = await this.send(item.payload); }
        catch (e) {
          this.update(item.key, { status: 'retry', nextAt: this.now() + Math.min(60000, 2000 * Math.pow(2, Math.min(item.attempts, 5))), error: e.message || '連線中斷，結果尚未確認。' });
          continue;
        }
        var data = response.data;
        if (response.status >= 200 && response.status < 300 && data && data.ok === true && (item.payload.type === 'undo' || (data.receipt && data.solid))) {
          this.update(item.key, { status: 'succeeded', response: data, error: '', confirmed: this.now() });
          this.notify(item.payload.type === 'undo' ? '已確認撤回：' + item.payload.id : '已確認入分：' + item.payload.id + ' · ' + (data.dispense || ''), false);
        } else if (data && data.ok === false && !data.needsReview && (response.status === 200 || [400,401,403,404,405,409,422].indexOf(response.status) >= 0)) {
          this.update(item.key, { status: 'rejected', error: data.msg || '系統未接受這筆操作，請核對資料。', response: data });
          this.notify(item.payload.id + '：' + (data.msg || '操作被拒絕'), true);
        } else {
          this.update(item.key, { status: 'retry', nextAt: this.now() + Math.min(60000, 2000 * Math.pow(2, Math.min(item.attempts, 5))), error: (data && data.msg) || '伺服器暫時未能確認，會以原操作編號重試。' });
        }
      }
    } finally { this.busy = false; this.changed(); }
  };
  root.BethesdaStationSync = { uid: uid, request: request, Outbox: Outbox };
})(typeof window === 'undefined' ? globalThis : window);
