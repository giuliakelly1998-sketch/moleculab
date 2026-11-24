import { bondAngle } from '../src/modules/explorer/Viewer3D';

describe('ângulo de ligação', () => {
  const o = { x: 0, y: 0, z: 0 };
  it('tetraédrico ideal = 109,47°', () => {
    // vértices de um tetraedro centrado na origem
    expect(bondAngle(o, { x: 1, y: 1, z: 1 }, { x: 1, y: -1, z: -1 })).toBeCloseTo(109.4712, 3);
  });
  it('trigonal plano = 120°, linear = 180°', () => {
    expect(bondAngle(o, { x: 1, y: 0, z: 0 }, { x: -0.5, y: Math.sqrt(3) / 2, z: 0 })).toBeCloseTo(120, 6);
    expect(bondAngle(o, { x: 1, y: 0, z: 0 }, { x: -2, y: 0, z: 0 })).toBeCloseTo(180, 6);
  });
  it('água com geometria experimental (r = 0,9572 Å, 104,52°)', () => {
    const t = (104.52 / 2) * (Math.PI / 180);
    const h1 = { x: 0.9572 * Math.sin(t), y: 0.9572 * Math.cos(t), z: 0 };
    const h2 = { x: -0.9572 * Math.sin(t), y: 0.9572 * Math.cos(t), z: 0 };
    expect(bondAngle(o, h1, h2)).toBeCloseTo(104.52, 6);
  });
  it('vetor nulo não gera número', () => {
    expect(bondAngle(o, o, { x: 1, y: 0, z: 0 })).toBeNaN();
  });
});
