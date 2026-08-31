// ---------------------------------------------------------------------------
// KaTeX 自动渲染配置：在 DOM 就绪后扫描文档，对 $...$ / $$...$$ 公式渲染
// 与 Material for MkDocs 的 SPA 导航钩子 document$.subscribe 协作
// ---------------------------------------------------------------------------
document$.subscribe(() => {
  if (typeof renderMathInElement === "function") {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false,
      strict: false,
      trust: true,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      ignoredClasses: ["arithmatex"] // 避免重复渲染 MkDocs arithmatex 生成的块
    });
  }
});
