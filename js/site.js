// 스크롤 리빌: JS가 없으면 콘텐츠는 그대로 보인다 (SPEC §6)
if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
}
