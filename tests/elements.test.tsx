import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PERIODIC, findElement, prettyConfig, gridPosition } from '../src/chem/periodic';
import { ELEMENTS } from '../src/chem/elements';
import { CELLS, cellGeometry, nearestNeighborPairs, theoreticalDensity, drawableCell } from '../src/chem/unitCell';
import { AppDataProvider } from '../src/state/AppDataContext';
import ElementPage from '../src/modules/elements/ElementPage';
import PeriodicTablePage from '../src/modules/elements/PeriodicTablePage';

describe('base de dados de elementos', () => {
  it('tem os 118 elementos na ordem, com símbolos coerentes com a tabela IUPAC do app', () => {
    expect(PERIODIC).toHaveLength(118);
    PERIODIC.forEach((e, i) => {
      expect(e.z).toBe(i + 1);
      expect(e.symbol).toBe(ELEMENTS[i].symbol);
    });
  });
  it('valores de referência conhecidos', () => {
    const al = findElement('Al')!;
    expect(al.latticeStructure).toBe('FCC');
    expect(al.latticeConstantA).toBeCloseTo(4.05, 2);
    expect(al.meltingK).toBeCloseTo(933.47, 1);
    expect(al.shells).toEqual([2, 8, 3]);
    expect(al.neutrons).toBe(14);
    expect(findElement('Fe')!.latticeStructure).toBe('BCC');
    expect(findElement('Sr')!.shells).toEqual([2, 8, 18, 8, 2]);
    expect(findElement('alumínio')!.symbol).toBe('Al');
    expect(findElement('26')!.symbol).toBe('Fe');
  });
  it('posições na tabela não se sobrepõem', () => {
    const seen = new Set(PERIODIC.map((e) => { const p = gridPosition(e); return `${p.row}-${p.col}`; }));
    expect(seen.size).toBe(118);
  });
  it('configuração com sobrescritos', () => {
    expect(prettyConfig('[Ne] 3s2 3p')).toBe('[Ne] 3s² 3p¹');
  });
});

describe('células unitárias (modelo de esferas rígidas)', () => {
  it('fatores de empacotamento clássicos', () => {
    expect(CELLS.SC.packingFactor).toBeCloseTo(0.524, 3);
    expect(CELLS.BCC.packingFactor).toBeCloseTo(0.680, 3);
    expect(CELLS.FCC.packingFactor).toBeCloseTo(0.740, 3);
    expect(CELLS.HCP.packingFactor).toBeCloseTo(0.740, 3);
    expect(CELLS.DIA.packingFactor).toBeCloseTo(0.340, 3);
  });
  it('densidade teórica reproduz a densidade medida', () => {
    expect(theoreticalDensity('FCC', 4.05, 26.9815)).toBeCloseTo(2.70, 1); // Al
    expect(theoreticalDensity('BCC', 2.87, 55.845)).toBeCloseTo(7.87, 1); // Fe
    expect(theoreticalDensity('FCC', 3.61, 63.546)).toBeCloseTo(8.96, 0); // Cu
    expect(theoreticalDensity('DIA', 5.431, 28.085)).toBeCloseTo(2.33, 1); // Si
  });
  it('todas as distâncias de vizinhos mais próximos são iguais e corretas', () => {
    for (const t of ['SC', 'BCC', 'FCC', 'DIA', 'HCP'] as const) {
      const a = 4;
      const geo = cellGeometry(t, a);
      const d = CELLS[t].nnDistance(a);
      const pairs = nearestNeighborPairs(geo, d);
      expect(pairs.length, t).toBeGreaterThan(0);
      // nenhum par de átomos mais próximo que a distância de vizinhos
      const at = geo.atoms;
      for (let i = 0; i < at.length; i++)
        for (let j = i + 1; j < at.length; j++) {
          const p = at[i].pos, q = at[j].pos;
          expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeGreaterThanOrEqual(d * 0.98);
        }
    }
  });
  it('contagem de átomos na célula convencional', () => {
    expect(cellGeometry('FCC', 1).atoms).toHaveLength(14);
    expect(cellGeometry('BCC', 1).atoms).toHaveLength(9);
    expect(cellGeometry('DIA', 1).atoms).toHaveLength(18);
    expect(cellGeometry('HCP', 1).atoms).toHaveLength(17);
  });
  it('só desenha como HC os metais realmente hexagonais compactos', () => {
    expect(drawableCell('Mg', 'HEX')).toBe('HCP');
    expect(drawableCell('Se', 'HEX')).toBeNull();
    expect(drawableCell('Mn', 'CUB')).toBeNull();
  });
});

const at = (path: string) =>
  render(
    <AppDataProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/elements" element={<PeriodicTablePage />} />
          <Route path="/elements/:symbol" element={<ElementPage />} />
        </Routes>
      </MemoryRouter>
    </AppDataProvider>,
  );

describe('páginas de elementos', () => {
  it('alumínio mostra propriedades, rede cristalina e N/A onde não há dado', () => {
    at('/elements/Al');
    expect(screen.getByRole('heading', { level: 1, name: 'Alumínio' })).toBeInTheDocument();
    expect(screen.getAllByText('Cúbica de face centrada (CFC)').length).toBeGreaterThan(0);
    expect(screen.getByText('K2 L8 M3')).toBeInTheDocument();
    expect(screen.getByText(/7429-90-5/)).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });
  it('seletor de variante troca o valor (raio)', () => {
    at('/elements/Al');
    const sel = screen.getByLabelText('Raio: variante');
    fireEvent.change(sel, { target: { value: 'vdw' } });
    expect(screen.getAllByText('184').length).toBeGreaterThan(0);
  });
  it('navega para o próximo elemento', () => {
    at('/elements/Al');
    fireEvent.click(screen.getByRole('button', { name: /Silício/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Silício' })).toBeInTheDocument();
  });
  it('tabela periódica lista os 118 elementos', () => {
    at('/elements');
    expect(screen.getAllByRole('button', { name: /^\d+/ }).length).toBeGreaterThanOrEqual(118);
  });
});
