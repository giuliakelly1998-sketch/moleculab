import { useMemo } from 'react';
import type { MoleculeRecord } from '../chem/molecule';
import { drawSvg } from '../chem/analysis';
import { useRDKit } from '../hooks/useRDKit';
import { useAppData } from '../state/AppDataContext';
import { Notice, Spinner } from './ui';

interface Props {
  record: MoleculeRecord;
  width?: number;
  height?: number;
  highlightAtoms?: number[];
  highlightBonds?: number[];
  highlightColor?: string;
}

const hexToRgb = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [58, 214, 230];
};

/** Desenho 2D gerado pelo RDKit, com destaque de átomos/ligações. */
export function Structure2D({ record, width = 520, height = 380, highlightAtoms, highlightBonds, highlightColor }: Props) {
  const { rdkit, status } = useRDKit();
  const { settings } = useAppData();
  const svg = useMemo(() => {
    if (!rdkit) return null;
    try {
      return drawSvg(rdkit, record, {
        width,
        height,
        highlightAtoms,
        highlightBonds,
        highlightColor: highlightColor ? hexToRgb(highlightColor) : undefined,
        darkInk: settings.theme === 'dark',
      });
    } catch {
      return null;
    }
  }, [rdkit, record, width, height, highlightAtoms, highlightBonds, highlightColor, settings.theme]);

  if (status === 'error') return <Notice kind="warn" title="RDKit indisponível">Não foi possível gerar o desenho 2D.</Notice>;
  if (!rdkit) return <Spinner label="Carregando RDKit…" />;
  if (!svg) return <Notice kind="warn">Não foi possível desenhar esta estrutura.</Notice>;
  // SVG produzido localmente pelo RDKit a partir de uma estrutura já validada.
  return <div className="svg-host" style={{ width: '100%' }} role="img" aria-label={`Estrutura 2D de ${record.title}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
