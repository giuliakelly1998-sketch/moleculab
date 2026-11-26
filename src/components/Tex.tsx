import { memo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Renderiza LaTeX com KaTeX. Em caso de erro de sintaxe, mostra o texto cru (nunca quebra a página). */
export const Tex = memo(function Tex({ tex, block = false, className }: { tex: string; block?: boolean; className?: string }) {
  const html = katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: 'ignore', output: 'html' });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
