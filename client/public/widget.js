/**
 * OA Agent 嵌入式聊天 widget（POC）。
 *
 * 第三方網站只要加一行即可接入：
 *   <script src="https://<你的網域>/widget.js"></script>
 *
 * 載入後在右下角注入一顆浮動按鈕，點擊彈出聊天視窗（iframe 載入 OA panel 的 ?embed=1 模式）。
 * 純 vanilla JS、零依賴、樣式全用 inline + 唯一 id 命名，避免污染宿主頁面。
 */
(function () {
  'use strict';

  // 同一頁重複載入時只初始化一次
  if (window.__oaAgentWidgetLoaded) return;
  window.__oaAgentWidgetLoaded = true;

  // panel 來源網域＝widget.js 自己的來源（換正式網域時零修改）
  // currentScript 在某些載入情境（async/module/被搬移）可能為 null，退回用 src 比對找回自己
  var script =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf('widget.js') !== -1) return all[i];
      }
      return null;
    })();
  if (!script) {
    console.error('[oa-agent] 找不到 widget script 標籤，無法初始化');
    return;
  }
  var origin = new URL(script.src).origin;
  // 可選設定：<script src=".../widget.js" data-title="客服小幫手">
  var title = script.getAttribute('data-title') || 'OA 小幫手';
  var panelUrl = origin + '/?embed=1';

  var Z = 2147483000; // 盡量蓋在宿主頁面之上
  var open = false;
  var iframe = null; // 延遲建立：首次點開才載入，避免拖慢宿主頁

  // ---- 浮動按鈕樣式（注入 scoped <style>，僅作用於 widget 自身元素，不污染宿主頁）----
  // 參考宿主站 .ai-highlight 樣式：漸層底色、機器人跳動動畫、上線小綠點、hover 浮起放大＋標籤
  var STYLE_ID = 'oa-agent-launcher-style';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#oa-agent-launcher{',
        'position:fixed;right:20px;bottom:20px;',
        'width:56px;height:56px;border-radius:50%;border:none;outline:none;',
        'display:flex;align-items:center;justify-content:center;overflow:visible;',
        'color:#fff;cursor:pointer;',
        'background:linear-gradient(135deg,#5896f5 0%,#2563eb 100%);',
        'box-shadow:0 4px 15px rgba(37,99,235,.35);',
        'z-index:' + (Z + 1) + ';',
        'transition:transform .3s cubic-bezier(.175,.885,.32,1.275),box-shadow .3s ease;',
      '}',
      '#oa-agent-launcher:hover,#oa-agent-launcher:focus-visible{',
        'transform:translateY(-2px) scale(1.1);',
        'box-shadow:0 10px 25px rgba(37,99,235,.45);',
      '}',
      '#oa-agent-launcher .oa-agent-icon{',
        'width:34px;height:34px;display:block;will-change:transform;',
        'animation:oa-agent-hop 5s infinite;',
      '}',
      '#oa-agent-launcher:hover .oa-agent-icon,#oa-agent-launcher:focus-visible .oa-agent-icon{',
        'animation-play-state:paused;',
      '}',
      '#oa-agent-launcher .oa-agent-status{',
        'position:absolute;top:2px;right:2px;width:11px;height:11px;border-radius:50%;',
        'border:2px solid #fff;background:#4ade80;box-shadow:0 0 8px rgba(74,222,128,.6);',
      '}',
      '#oa-agent-launcher .oa-agent-label{',
        'position:absolute;right:calc(100% + 12px);top:50%;',
        'transform:translateY(-50%) translateX(10px);',
        'white-space:nowrap;padding:4px 12px;border-radius:12px;',
        'background:hsla(0,0%,100%,.98);color:#2563eb;font-size:12px;font-weight:800;',
        'border:1px solid rgba(37,99,235,.1);box-shadow:0 6px 16px rgba(0,0,0,.12);',
        'opacity:0;visibility:hidden;pointer-events:none;',
        'transition:opacity .3s cubic-bezier(.165,.84,.44,1),transform .3s cubic-bezier(.165,.84,.44,1),visibility .3s;',
      '}',
      '#oa-agent-launcher:hover .oa-agent-label,#oa-agent-launcher:focus-visible .oa-agent-label{',
        'opacity:1;visibility:visible;transform:translateY(-50%) translateX(0);',
      '}',
      '@keyframes oa-agent-hop{',
        '0%,80%,100%{transform:translateY(0) rotate(0);}',
        '85%{transform:translateY(-5px) rotate(-8deg);}',
        '90%{transform:translateY(-7px) rotate(8deg);}',
        '95%{transform:translateY(-5px) rotate(0);}',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  // ---- 浮動按鈕 ----
  var btn = document.createElement('button');
  btn.id = 'oa-agent-launcher';
  btn.type = 'button';
  btn.setAttribute('aria-label', title);
  // 機器人 icon（inline 實心 SVG，避免依賴宿主頁的 Font Awesome；眼睛以 evenodd 鏤空透出底色）＋ 上線小綠點
  btn.innerHTML =
    '<svg class="oa-agent-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="12" cy="2.6" r="1.5"/>' +
    '<rect x="11.25" y="3.6" width="1.5" height="2.2" rx="0.75"/>' +
    '<rect x="2" y="10" width="2" height="5" rx="1"/>' +
    '<rect x="20" y="10" width="2" height="5" rx="1"/>' +
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M7 5.5h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Zm2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>' +
    '</svg>' +
    '<span class="oa-agent-status"></span>';
  // 標籤用 textContent 設定，避免 data-title 注入 HTML
  var label = document.createElement('span');
  label.className = 'oa-agent-label';
  label.textContent = title;
  btn.appendChild(label);

  // ---- 聊天彈窗容器 ----
  var panel = document.createElement('div');
  panel.id = 'oa-agent-panel';
  panel.style.cssText = [
    'position:fixed', 'right:20px', 'bottom:88px',
    'width:400px', 'height:640px', 'max-width:calc(100vw - 40px)',
    'max-height:calc(100vh - 120px)',
    'border-radius:16px', 'overflow:hidden',
    'box-shadow:0 12px 40px rgba(0,0,0,.3)', 'background:#fff',
    'z-index:' + Z, 'display:none',
    'opacity:0', 'transform:translateY(8px)', 'transition:opacity .15s ease, transform .15s ease',
  ].join(';');

  // 手機（窄螢幕）改為近全螢幕
  function applyMobile() {
    if (window.innerWidth <= 480) {
      panel.style.right = '0';
      panel.style.bottom = '0';
      panel.style.width = '100vw';
      panel.style.height = '100vh';
      panel.style.maxHeight = '100vh';
      panel.style.borderRadius = '0';
    }
  }
  applyMobile();
  window.addEventListener('resize', applyMobile);

  function setOpen(next) {
    open = next;
    if (open) {
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.src = panelUrl;
        iframe.title = title;
        iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
        panel.appendChild(iframe);
      }
      panel.style.display = 'block';
      // 下一幀再做過場動畫
      requestAnimationFrame(function () {
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
      });
    } else {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(8px)';
      setTimeout(function () { if (!open) panel.style.display = 'none'; }, 150);
    }
  }

  btn.addEventListener('click', function () { setOpen(!open); });
  // panel 內聊天頁可 postMessage({type:'oa-agent:close'}) 來關閉（之後 embed 模式加關閉鈕用）
  window.addEventListener('message', function (e) {
    if (e.origin === origin && e.data && e.data.type === 'oa-agent:close') setOpen(false);
  });

  // 宿主頁可能把 script 放在 <head>，此時 body 尚未存在 → 等 DOM ready 再掛載
  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }
  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
