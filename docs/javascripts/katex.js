function renderMath() {
  if (typeof renderMathInElement === 'undefined') return;

  const options = {
    delimiters: [
      {left: '$$', right: '$$', display: true},
      {left: '$', right: '$', display: false},
      {left: '\\[', right: '\\]', display: true},
      {left: '\\(', right: '\\)', display: false}
    ],
    throwOnError: false,
    strict: false,
    trust: true
  };

  // pymdownx.arithmatex (generic: true) 会保留 \(\) / \[\] 定界符。
  // 只在 .arithmatex 容器内扫描，避免全局扫描时把正文中的 $ 误匹配。
  document.querySelectorAll('.arithmatex').forEach(function(el) {
    renderMathInElement(el, options);
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
