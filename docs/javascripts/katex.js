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

  // 只扫描 pymdownx 生成的数学公式容器 (.arithmatex)，
  // 避免全局扫描时把正文中的 $ 误匹配为行内公式。
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
