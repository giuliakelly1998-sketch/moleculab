import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalculatorCard } from '../src/modules/calculator/CalculatorCard';
import { MolarMassCalculator } from '../src/modules/calculator/MolarMassCalculator';
import { getCalculator, CalcDef } from '../src/calc/calculators';
import { NatureBadge } from '../src/components/ui';
import { AppDataProvider } from '../src/state/AppDataContext';
import KnowledgePage from '../src/modules/knowledge/KnowledgePage';

const wrap = (ui: React.ReactNode) => render(<AppDataProvider><MemoryRouter>{ui}</MemoryRouter></AppDataProvider>);

describe('calculadora (componente)', () => {
  it('massa → mol: mostra resultado, substituição e verificação dimensional', () => {
    wrap(<CalculatorCard def={getCalculator('massa-mol') as CalcDef} />);
    fireEvent.change(screen.getByLabelText(/^m Massa$/), { target: { value: '36,03' } });
    fireEvent.change(screen.getByLabelText(/^M Massa molar$/), { target: { value: '18.015' } });
    expect(screen.getAllByText('2').some((el) => el.classList.contains('mono'))).toBe(true);
    // Substituição renderizada em notação matemática (KaTeX), com o resultado na mesma unidade de trabalho.
    const sub = screen.getByText(/Substituição/).nextElementSibling as HTMLElement;
    expect(sub.querySelector('.katex')).not.toBeNull();
    expect(sub.textContent).toContain('36,03');
    expect(sub.textContent).toContain('18,015');
    expect(screen.getByText(/Dimensão N — consistente com quantidade de matéria/)).toBeInTheDocument();
  });

  it('preenche M a partir da fórmula', () => {
    wrap(<CalculatorCard def={getCalculator('massa-mol') as CalcDef} />);
    fireEvent.change(screen.getByLabelText(/Fórmula para calcular/), { target: { value: 'H2O' } });
    expect((screen.getByLabelText(/^M Massa molar$/) as HTMLInputElement).value).toBe('18.015');
  });

  it('valida entradas inválidas e negativas', () => {
    wrap(<CalculatorCard def={getCalculator('massa-mol') as CalcDef} />);
    const m = screen.getByLabelText(/^m Massa$/);
    fireEvent.change(m, { target: { value: 'abc' } });
    fireEvent.blur(m);
    expect(screen.getByText(/Número inválido/)).toBeInTheDocument();
    fireEvent.change(m, { target: { value: '-3' } });
    expect(screen.getByText(/Não pode ser negativo/)).toBeInTheDocument();
    expect(screen.getByText(/Preencha todos os campos/)).toBeInTheDocument();
  });

  it('aceita 0 °C, mas rejeita temperatura abaixo do zero absoluto', () => {
    wrap(<CalculatorCard def={getCalculator('gases-ideais') as CalcDef} />);
    const T = screen.getByLabelText(/^T Temperatura$/);
    fireEvent.change(screen.getByLabelText('Unidade de Temperatura'), { target: { value: 'C' } });
    fireEvent.change(T, { target: { value: '0' } });
    fireEvent.blur(T);
    expect(screen.queryByText(/Abaixo do zero absoluto/)).not.toBeInTheDocument();
    fireEvent.change(T, { target: { value: '-300' } });
    expect(screen.getByText(/Abaixo do zero absoluto/)).toBeInTheDocument();
  });

  it('diluição que concentraria a solução mostra erro explicativo', () => {
    wrap(<CalculatorCard def={getCalculator('diluicao') as CalcDef} />);
    fireEvent.click(screen.getByRole('button', { name: 'calcular c₂' }));
    fireEvent.change(screen.getByLabelText(/^c₁ Concentração inicial$/), { target: { value: '0.1' } });
    fireEvent.change(screen.getByLabelText(/^V₁ Volume da alíquota$/), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/^V₂ Volume final$/), { target: { value: '10' } });
    expect(screen.getByText(/não diluição/)).toBeInTheDocument();
  });
});

describe('massa molar (componente)', () => {
  it('calcula glicose por padrão e mostra composição', () => {
    wrap(<MolarMassCalculator />);
    expect(screen.getByText('180,156')).toBeInTheDocument();
    expect(screen.getByText('Carbono')).toBeInTheDocument();
  });
});

describe('selos de natureza do dado', () => {
  it.each(['experimental', 'calculado', 'estimado', 'indisponível'] as const)('%s', (n) => {
    render(<NatureBadge nature={n} />);
    expect(screen.getByText(n)).toBeInTheDocument();
  });
});

describe('base de conhecimento', () => {
  it('lista tópicos e filtra por termo', () => {
    wrap(<KnowledgePage />);
    expect(screen.getByRole('heading', { name: /equação de Nernst/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrar tópicos'), { target: { value: 'Bragg' } });
    expect(screen.getByRole('heading', { name: /difração de raios X/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /equação de Nernst/ })).not.toBeInTheDocument();
  });
});

describe('troca de calculadora (regressão)', () => {
  it('todas as calculadoras abrem ao navegar a partir de outra, sem erro de unidade', async () => {
    const { MemoryRouter: MR, Routes, Route } = await import('react-router-dom');
    const { default: CalculatorPage } = await import('../src/modules/calculator/CalculatorPage');
    const { CALCULATORS } = await import('../src/calc/calculators');
    render(
      <AppDataProvider>
        <MR initialEntries={['/calculator/massa-mol']}>
          <Routes>
            <Route path="/calculator/:id" element={<CalculatorPage />} />
          </Routes>
        </MR>
      </AppDataProvider>,
    );
    for (const c of CALCULATORS) {
      fireEvent.click(screen.getAllByRole('link', { name: c.title })[0]);
      expect(screen.getByRole('heading', { level: 2, name: c.title })).toBeInTheDocument();
    }
  });

  it('mol → massa calcula após vir de outra calculadora', async () => {
    const { MemoryRouter: MR, Routes, Route } = await import('react-router-dom');
    const { default: CalculatorPage } = await import('../src/modules/calculator/CalculatorPage');
    render(
      <AppDataProvider>
        <MR initialEntries={['/calculator/massa-mol']}>
          <Routes>
            <Route path="/calculator/:id" element={<CalculatorPage />} />
          </Routes>
        </MR>
      </AppDataProvider>,
    );
    fireEvent.click(screen.getAllByRole('link', { name: 'Mol → massa' })[0]);
    fireEvent.change(screen.getByLabelText(/^n Quantidade de matéria$/), { target: { value: '0,5' } });
    fireEvent.change(screen.getByLabelText(/^M Massa molar$/), { target: { value: '58,44' } });
    expect(screen.getByText('29,22')).toBeInTheDocument();
  });
});

describe('calculadora: unidades homogêneas na substituição', () => {
  it('Gibbs converte ΔH (kJ/mol) para J/mol antes de subtrair T·ΔS', () => {
    wrap(<CalculatorCard def={getCalculator('gibbs') as CalcDef} />);
    fireEvent.change(screen.getByLabelText(/^ΔH Variação de entalpia$/), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/^T Temperatura$/), { target: { value: '520' } });
    fireEvent.change(screen.getByLabelText(/^ΔS Variação de entropia$/), { target: { value: '100' } });
    const sub = screen.getByText(/Substituição/).nextElementSibling as HTMLElement;
    const txt = sub.textContent ?? '';
    expect(txt).toContain('500000');
    expect(txt).toContain('448000');
    expect(txt).not.toContain('kJ');
  });
});
