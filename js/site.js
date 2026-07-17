// 사진 클릭 확대 (라이트박스) — 사진이 실린 곳 어디서든 클릭하면 크게 보인다
(function () {
  var ZOOM = '.photo-slot img, .photo-stack img, .case-card img, .portrait img, .frame img, .map-box img';
  var lb = null;
  function close() { if (lb) { lb.classList.remove('on'); document.body.style.overflow = ''; } }
  function open(src, alt) {
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = '<button class="lb-close" aria-label="닫기">✕</button><img alt=""><p class="lb-cap"></p>';
      lb.addEventListener('click', close);
      document.body.appendChild(lb);
    }
    lb.querySelector('img').src = src;
    lb.querySelector('img').alt = alt;
    lb.querySelector('.lb-cap').textContent = alt;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { lb.classList.add('on'); });
  }
  document.addEventListener('click', function (e) {
    if (document.body.contentEditable === 'true') return; // 편집 모드 중엔 확대 대신 편집
    var img = e.target.closest(ZOOM);
    if (!img || !img.src) return;
    e.preventDefault();
    // 캡션: img alt 또는 같은 figure의 figcaption
    var fig = img.closest('figure');
    var cap = (fig && fig.querySelector('figcaption')) ? fig.querySelector('figcaption').textContent : (img.alt || '');
    open(img.src, cap);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();

// 스크롤 리빌: JS가 없으면 콘텐츠는 그대로 보인다 (SPEC §6)
if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
}
