// 편집 모드 (SPEC §10) — 어머니가 워드처럼 글자를 직접 타자로 수정하는 기능.
// ?edit 으로 켜짐. 수정 내용은 이 브라우저에만 저장되며(초안), "파일로 내보내기"로
// 받은 파일을 전달받아 반영·재배포한다. 방문자는 이 코드의 영향을 받지 않는다.
(function () {
  'use strict';
  var FLAG = 'taerim-edit';
  // 내보낸 수정본 파일은 마커 메타태그를 갖고 있어, 어느 기기에서 열어도 편집 모드가 켜진다
  var isExported = !!document.querySelector('meta[name="taerim-exported"]');
  var wantEdit = /[?&]edit\b/.test(location.search) || isExported;
  try { wantEdit = wantEdit || sessionStorage.getItem(FLAG) === '1'; } catch (e) {}
  if (!wantEdit) return;
  try { sessionStorage.setItem(FLAG, '1'); } catch (e) {}

  var draftKey = 'taerim-draft:' + location.pathname;
  var editing = false;
  var bar, toast;

  function pageName() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p.replace('.html', '') || 'index';
  }

  /* ── 스타일 ── */
  var css = document.createElement('style');
  css.textContent =
    '#taerim-editbar{position:fixed;top:0;left:0;right:0;z-index:9999;background:#221D15;color:#F8F4EC;' +
    'display:flex;align-items:center;gap:.5rem;padding:.55rem .9rem;flex-wrap:wrap;font-family:Pretendard,sans-serif;' +
    'font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.3)}' +
    '#taerim-editbar b{margin-right:.4rem}' +
    '#taerim-editbar button{border:1px solid #6A6354;background:#3A3428;color:#F8F4EC;border-radius:6px;' +
    'padding:.5rem .9rem;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '#taerim-editbar button:hover{background:#41522F;border-color:#41522F}' +
    '#taerim-editbar button.primary{background:#41522F;border-color:#41522F}' +
    '#taerim-editbar .hint{flex-basis:100%;font-size:12px;color:#B9B2A2;margin-top:.15rem}' +
    '#taerim-editbar .fmt{display:flex;align-items:center;gap:.35rem;padding-left:.6rem;border-left:1px solid #6A6354}' +
    '#taerim-editbar .fmt b.lbl{font-size:12px;color:#B9B2A2;font-weight:600;margin:0}' +
    '#taerim-editbar .sw{width:26px;height:26px;border-radius:50%;border:2px solid #6A6354;cursor:pointer;padding:0}' +
    '#taerim-editbar .sw:hover{border-color:#F8F4EC}' +
    '#taerim-editbar input[type=color]{width:30px;height:28px;border:1px solid #6A6354;border-radius:6px;background:none;cursor:pointer;padding:1px}' +
    '#taerim-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;' +
    'background:#41522F;color:#fff;padding:.6rem 1.2rem;border-radius:999px;font-size:14px;font-weight:700;' +
    'opacity:0;transition:opacity .3s;pointer-events:none}' +
    'body.taerim-editing [contenteditable="true"]:hover{outline:1px dashed #5C7040;outline-offset:2px}';
  document.head.appendChild(css);

  function showToast(msg) {
    if (!toast) { toast = document.createElement('div'); toast.id = 'taerim-toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.style.opacity = '0'; }, 1800);
  }

  /* ── 초안 저장/복원 ── */
  function bodyHTMLWithoutBar() {
    var clone = document.body.cloneNode(true);
    ['#taerim-editbar', '#taerim-toast'].forEach(function (sel) {
      var el = clone.querySelector(sel);
      if (el) el.remove();
    });
    return clone.innerHTML;
  }
  function saveDraft(silent) {
    try {
      localStorage.setItem(draftKey, bodyHTMLWithoutBar());
      if (!silent) showToast('임시 저장됨 — 다음에 이어서 편집할 수 있어요');
    } catch (e) { showToast('저장 실패: 브라우저 저장 공간 부족'); }
  }
  function restoreDraft() {
    var d = localStorage.getItem(draftKey);
    if (!d) return;
    if (confirm('저장해 둔 수정본이 있습니다. 이어서 편집할까요?\n(취소를 누르면 원래 글로 시작합니다)')) {
      document.body.innerHTML = d;
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      bar = null; // 툴바 다시 만들기
    }
  }

  /* ── 편집 켜고 끄기 ── */
  function setEditing(on) {
    editing = on;
    document.body.contentEditable = on ? 'true' : 'false';
    document.body.classList.toggle('taerim-editing', on);
    // 편집 제외 구역: 툴바, 마퀴(같은 글이 두 번 렌더되는 장식)
    document.querySelectorAll('#taerim-editbar, .marquee').forEach(function (el) {
      el.contentEditable = 'false';
    });
    var btn = bar.querySelector('[data-act="toggle"]');
    btn.textContent = on ? '⏸ 잠시 멈춤 (링크 이동용)' : '✏️ 편집 시작';
    btn.classList.toggle('primary', !on);
    showToast(on ? '편집 중 — 글자를 클릭하고 타자 치세요' : '편집 잠시 멈춤 — 링크로 이동할 수 있어요');
  }

  /* ── 파일로 내보내기 ── */
  function exportFile() {
    saveDraft(true);
    var doc = document.documentElement.cloneNode(true);
    ['#taerim-editbar', '#taerim-toast'].forEach(function (sel) {
      var el = doc.querySelector(sel);
      if (el) el.remove();
    });
    doc.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    var body = doc.querySelector('body');
    if (body) body.classList.remove('taerim-editing');
    // 상대 경로 → 절대 주소: 이 파일을 다른 PC에서 열어도 디자인·편집 기능이 그대로 살아난다
    var base = new URL('.', location.href).href;
    doc.querySelectorAll('[href],[src]').forEach(function (el) {
      ['href', 'src'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (!v || /^(https?:|tel:|mailto:|#|data:|\/\/|\{\{)/i.test(v)) return;
        try { el.setAttribute(attr, new URL(v, base).href); } catch (e) {}
      });
    });
    // 내보낸 파일 마커 (열면 편집 모드 자동 시작)
    var head = doc.querySelector('head');
    if (head && !head.querySelector('meta[name="taerim-exported"]')) {
      var m = doc.ownerDocument.createElement('meta');
      m.setAttribute('name', 'taerim-exported');
      m.setAttribute('content', location.href);
      head.appendChild(m);
    }
    var d = new Date();
    var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var blob = new Blob(['<!DOCTYPE html>\n' + doc.outerHTML], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '수정본-' + pageName() + '-' + stamp + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('파일로 저장했어요 — 이 파일을 아들에게 보내 주세요');
  }

  /* ── 툴바 ── */
  function buildBar() {
    bar = document.createElement('div');
    bar.id = 'taerim-editbar';
    bar.innerHTML =
      '<b>✏️ 편집 모드</b>' +
      '<button data-act="toggle" class="primary">✏️ 편집 시작</button>' +
      '<button data-act="save">💾 임시 저장</button>' +
      '<button data-act="export">📤 파일로 내보내기</button>' +
      '<button data-act="reset">↩ 원래대로</button>' +
      '<button data-act="quit">✖ 편집 종료</button>' +
      '<span class="fmt"><b class="lbl">서식:</b>' +
      '<button data-fmt="bold" title="굵게"><b>가</b></button>' +
      '<button class="sw" data-color="#221D15" style="background:#221D15" title="검정(기본)"></button>' +
      '<button class="sw" data-color="#41522F" style="background:#41522F" title="쑥녹색"></button>' +
      '<button class="sw" data-color="#B3261E" style="background:#B3261E" title="빨강"></button>' +
      '<button class="sw" data-color="#1F5C9F" style="background:#1F5C9F" title="파랑"></button>' +
      '<input type="color" value="#221D15" title="다른 색 고르기">' +
      '</span>' +
      '<span class="hint">글자를 클릭하고 바로 타자 치세요. 색을 바꾸려면 글자를 마우스로 긁어 선택한 뒤 색 동그라미를 누르세요. 고치다 말고 닫아도 임시 저장돼요. 다 고치면 [파일로 내보내기]를 눌러 아들에게 보내 주세요.</span>';
    document.body.appendChild(bar);
    document.body.style.paddingTop = '86px';
    // 서식 적용: <font> 태그 대신 style="color:..." 스팬을 만들게 함
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    var savedRange = null;
    function keepSelection() {
      var s = window.getSelection();
      if (s.rangeCount && !s.isCollapsed) savedRange = s.getRangeAt(0).cloneRange();
    }
    function applyFmt(cmd, val) {
      if (savedRange) {
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(savedRange);
      }
      if (window.getSelection().isCollapsed) { showToast('먼저 글자를 마우스로 긁어 선택해 주세요'); return; }
      document.execCommand(cmd, false, val);
      saveDraft(true);
    }
    // 서식 버튼은 mousedown에서 선택 영역을 기억해 둔다 (클릭하면 선택이 풀리므로)
    bar.addEventListener('mousedown', function (e) {
      if (e.target.closest('.fmt')) {
        keepSelection();
        if (e.target.closest('button')) e.preventDefault();
      }
    });
    var picker = bar.querySelector('input[type=color]');
    picker.addEventListener('change', function () { applyFmt('foreColor', picker.value); });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-fmt')) { applyFmt(b.getAttribute('data-fmt')); return; }
      if (b.hasAttribute('data-color')) { applyFmt('foreColor', b.getAttribute('data-color')); return; }
      var act = b.getAttribute('data-act');
      if (act === 'toggle') setEditing(!editing);
      if (act === 'save') saveDraft();
      if (act === 'export') exportFile();
      if (act === 'reset') {
        if (confirm('이 페이지의 수정 내용을 모두 버리고 원래 글로 되돌릴까요?')) {
          localStorage.removeItem(draftKey);
          location.reload();
        }
      }
      if (act === 'quit') {
        saveDraft(true);
        sessionStorage.removeItem(FLAG);
        location.href = location.pathname;
      }
    });
  }

  /* ── 편집 중 링크 이동 막기 (글자 수정이 우선) ── */
  document.addEventListener('click', function (e) {
    if (editing && e.target.closest('a') && !e.target.closest('#taerim-editbar')) e.preventDefault();
  }, true);

  /* ── 20초마다 자동 저장 ── */
  setInterval(function () { if (editing) saveDraft(true); }, 20000);

  /* ── 시작 ── */
  function boot() {
    restoreDraft();
    buildBar();
    setEditing(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
