function renderMath() {
  if (typeof katex === 'undefined') return;

  // pymdownx.arithmatex (generic: true) 已剥离 $/$$ 定界符，
  // 将行内公式输出为 <span class="arithmatex">...</span>，
  // 将块级公式输出为 <div class="arithmatex">...</div>。
  // 因此直接对每个容器调用 katex.render，无需再用 renderMathInElement 扫描定界符。
  document.querySelectorAll('.arithmatex').forEach(function(el) {
    const isDisplay = el.tagName.toLowerCase() === 'div';
    katex.render(el.textContent, el, {
      throwOnError: false,
      displayMode: isDisplay,
      strict: false,
      trust: true
    });
  });
}

// 首次加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderMath);
} else {
  renderMath();
}

// SPA 导航回退（Material for MkDocs instant loading）
if (typeof document$ !== 'undefined') {
  document$.subscribe(renderMath);
}
