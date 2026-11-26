export type Area =
  | 'geral'
  | 'organica'
  | 'inorganica'
  | 'fisicoquimica'
  | 'analitica'
  | 'materiais'
  | 'experimental';

export const AREA_LABELS: Record<Area, string> = {
  geral: 'Química Geral',
  organica: 'Química Orgânica',
  inorganica: 'Química Inorgânica',
  fisicoquimica: 'Físico-Química',
  analitica: 'Química Analítica',
  materiais: 'Química de Materiais',
  experimental: 'Química Experimental',
};

export interface KnowledgeTopic {
  id: string;
  area: Area;
  title: string;
  definition: string;
  theory: string[];
  /** expr: texto simples (busca/acessibilidade); tex: a mesma equação em LaTeX; sem tex = código (ex.: SMARTS). */
  equations: { expr: string; tex?: string; meaning: string }[];
  examples: string[];
  applications: string[];
  refs: string[]; // chaves de REFS
  /** Ferramenta do MOLECULAB relacionada. */
  tool?: { label: string; to: string };
}

export const TOPICS: KnowledgeTopic[] = [
  {
    id: 'mol',
    area: 'geral',
    title: 'Quantidade de matéria e o mol',
    definition: 'O mol é a unidade SI de quantidade de matéria. Desde 2019, um mol contém exatamente 6,02214076 × 10²³ entidades elementares; esse número é o valor numérico fixo da constante de Avogadro expressa em mol⁻¹.',
    theory: [
      'A redefinição de 2019 desvinculou o mol da massa do carbono-12: a constante de Avogadro passou a ser exata, e a massa molar do ¹²C deixou de ser exatamente 12 g/mol (continua igual a esse valor dentro de incertezas de 10⁻⁹).',
      'Massa molar (M) é a razão entre massa e quantidade de matéria de uma substância. Para compostos, é a soma das massas atômicas médias dos elementos, ponderadas pela fórmula. As massas atômicas padrão dependem da composição isotópica natural e, para alguns elementos, são dadas como intervalos.',
    ],
    equations: [
      { expr: 'n = m / M', tex: "n = \\dfrac{m}{M}", meaning: 'n em mol, m em g, M em g/mol' },
      { expr: 'N = n · Nₐ', tex: "N = n \\cdot N_A", meaning: 'número de entidades; Nₐ = 6,02214076 × 10²³ mol⁻¹' },
    ],
    examples: ['18,0 g de água (M = 18,015 g/mol) correspondem a 0,999 mol, ou 6,02 × 10²³ moléculas.'],
    applications: ['Pesagem de reagentes', 'Conversão entre escalas macroscópica e molecular', 'Preparo de soluções'],
    refs: ['greenBook', 'codata', 'ciaaw', 'atkinsPrinciples'],
    tool: { label: 'Calculadora massa ↔ mol', to: '/calculator/massa-mol' },
  },
  {
    id: 'estequiometria',
    area: 'geral',
    title: 'Estequiometria e reagente limitante',
    definition: 'Estequiometria é o estudo das relações quantitativas entre reagentes e produtos em uma reação química balanceada.',
    theory: [
      'Os coeficientes da equação balanceada expressam razões entre quantidades de matéria, não entre massas. Por isso toda conta estequiométrica passa por mols.',
      'A extensão de reação ξ mede quanto a reação avançou: nᵢ = nᵢ,₀ + νᵢξ, com νᵢ negativo para reagentes. O reagente limitante é aquele que se esgota primeiro, ou seja, o de menor razão nᵢ,₀/|νᵢ|.',
      'O rendimento teórico é a quantidade máxima de produto prevista; o rendimento real costuma ser menor por reações paralelas, equilíbrio incompleto e perdas no isolamento.',
    ],
    equations: [
      { expr: 'ξ_máx = min(nᵢ,₀ / |νᵢ|)', tex: "\\xi_{\\text{m\u00e1x}} = \\min\\left(\\dfrac{n_{i,0}}{|\\nu_i|}\\right)", meaning: 'extensão máxima, definida pelo reagente limitante' },
      { expr: 'η = m_real / m_teórica × 100 %', tex: "\\eta = \\dfrac{m_{\\text{real}}}{m_{\\text{te\u00f3rica}}} \\times 100\\,\\%", meaning: 'rendimento percentual' },
    ],
    examples: ['Em 2 H₂ + O₂ → 2 H₂O, com 4,0 g de H₂ (1,98 mol) e 32,0 g de O₂ (1,00 mol): ξ_H₂ = 0,99 mol e ξ_O₂ = 1,00 mol, logo H₂ é o limitante.'],
    applications: ['Planejamento de sínteses', 'Cálculo de custos de processo', 'Análise gravimétrica'],
    refs: ['atkinsPrinciples', 'greenBook'],
    tool: { label: 'Calculadora de reagente limitante', to: '/calculator/reagente-limitante' },
  },
  {
    id: 'grupos-funcionais',
    area: 'organica',
    title: 'Grupos funcionais',
    definition: 'Grupo funcional é um conjunto de átomos ligados de forma característica que determina boa parte da reatividade e das propriedades de uma molécula orgânica.',
    theory: [
      'A reatividade se concentra em regiões com heteroátomos, ligações múltiplas ou ligações polarizadas. Moléculas com o mesmo grupo funcional tendem a sofrer as mesmas classes de reação.',
      'O contexto importa: uma hidroxila ligada a carbono sp³ (álcool) tem pKa ≈ 16, enquanto ligada a anel aromático (fenol) tem pKa ≈ 10, pela deslocalização da carga do ânion. Por isso o reconhecimento automático precisa considerar a vizinhança, e não apenas a presença de um O–H.',
      'Em quimioinformática, grupos funcionais são descritos por padrões SMARTS, que especificam elemento, número de conexões, hidrogênios, aromaticidade e ambiente químico de cada átomo.',
    ],
    equations: [{ expr: '[OX2H][CX4]  vs  [OX2H][c]', meaning: 'SMARTS que distinguem álcool de fenol' }],
    examples: ['Ácido acetilsalicílico: ácido carboxílico + éster + anel aromático.', 'Paracetamol: fenol + amida + anel aromático.'],
    applications: ['Previsão de reatividade', 'Planejamento de sínteses', 'Triagem de bibliotecas de compostos'],
    refs: ['clayden', 'smarts', 'goldBook'],
    tool: { label: 'Identificador de grupos funcionais', to: '/functional-groups' },
  },
  {
    id: 'aromaticidade',
    area: 'organica',
    title: 'Aromaticidade',
    definition: 'Compostos aromáticos são cíclicos, planares e totalmente conjugados, com 4n + 2 elétrons π (regra de Hückel), o que lhes confere estabilização extra.',
    theory: [
      'A energia de estabilização aromática do benzeno é estimada em cerca de 150 kJ/mol, comparando o calor de hidrogenação medido com o esperado para três ligações duplas isoladas.',
      'Sistemas cíclicos conjugados com 4n elétrons π são antiaromáticos e desestabilizados; muitos se distorcem para sair da planaridade.',
      'Heterociclos como piridina, furano e pirrol são aromáticos; no pirrol e no furano, o par isolado do heteroátomo participa do sexteto π.',
    ],
    equations: [{ expr: 'elétrons π = 4n + 2  (n = 0, 1, 2, …)', tex: "\\text{el\u00e9trons } \\pi = 4n + 2 \\quad (n = 0, 1, 2, \\ldots)", meaning: 'regra de Hückel' }],
    examples: ['Benzeno (6 e⁻ π, n = 1)', 'Ciclopentadienila (C₅H₅⁻, 6 e⁻ π)', 'Naftaleno (10 e⁻ π, n = 2)'],
    applications: ['Corantes', 'Fármacos', 'Polímeros condutores'],
    refs: ['clayden', 'goldBook'],
  },
  {
    id: 'campo-cristalino',
    area: 'inorganica',
    title: 'Teoria do campo cristalino',
    definition: 'Modelo eletrostático que descreve como os ligantes desdobram a energia dos orbitais d de um íon metálico em um complexo.',
    theory: [
      'Em campo octaédrico, os orbitais d se separam em t₂g (mais baixos) e e_g (mais altos), com diferença Δₒ. Em campo tetraédrico, o desdobramento é invertido e menor (Δₜ ≈ 4/9 Δₒ).',
      'A série espectroquímica ordena ligantes pela intensidade do campo (I⁻ < Br⁻ < Cl⁻ < F⁻ < OH⁻ < H₂O < NH₃ < en < CN⁻ < CO). Campos fortes favorecem configurações de spin baixo.',
      'A teoria explica cores, propriedades magnéticas e tendências de estabilidade; a teoria do campo ligante incorpora o caráter covalente da ligação.',
    ],
    equations: [
      { expr: 'EECC = (−0,4 n_t₂g + 0,6 n_eg) Δₒ', tex: "\\text{EECC} = \\left(-0{,}4\\, n_{t_{2g}} + 0{,}6\\, n_{e_g}\\right) \\Delta_o", meaning: 'energia de estabilização do campo cristalino (octaédrico)' },
      { expr: 'μ_so = √[n(n + 2)] μ_B', tex: "\\mu_{\\text{so}} = \\sqrt{n(n+2)}\\;\\mu_B", meaning: 'momento magnético apenas de spin, n = elétrons desemparelhados' },
    ],
    examples: ['[Fe(H₂O)₆]²⁺ é de spin alto (4 e⁻ desemparelhados); [Fe(CN)₆]⁴⁻ é de spin baixo (diamagnético).'],
    applications: ['Interpretação de espectros UV-Vis', 'Pigmentos', 'Catálise'],
    refs: ['weller', 'housecroft'],
  },
  {
    id: 'acidos-bases-lewis',
    area: 'inorganica',
    title: 'Ácidos e bases de Lewis e o princípio HSAB',
    definition: 'Ácido de Lewis aceita um par de elétrons; base de Lewis o doa. O princípio HSAB (Pearson) prevê que ácidos duros preferem bases duras e ácidos macios, bases macias.',
    theory: [
      'Espécies duras são pequenas, pouco polarizáveis e com alta densidade de carga (H⁺, Li⁺, Al³⁺, F⁻, OH⁻). Espécies macias são grandes e polarizáveis (Ag⁺, Hg²⁺, Pt²⁺, I⁻, R₂S).',
      'Interações duro–duro têm caráter mais iônico; macio–macio, mais covalente.',
    ],
    equations: [{ expr: 'A + :B → A–B', tex: "\\mathrm{A} + {:}\\mathrm{B} \\longrightarrow \\mathrm{A{-}B}", meaning: 'formação de aduto ácido–base de Lewis' }],
    examples: ['BF₃ + NH₃ → F₃B–NH₃', 'Hg²⁺ forma complexos muito estáveis com ligantes contendo enxofre.'],
    applications: ['Química de coordenação', 'Toxicologia de metais', 'Catálise ácida de Lewis'],
    refs: ['weller', 'housecroft'],
  },
  {
    id: 'cinetica-arrhenius',
    area: 'fisicoquimica',
    title: 'Cinética química e equação de Arrhenius',
    definition: 'A equação de Arrhenius relaciona a constante de velocidade de uma reação à temperatura, por meio da energia de ativação Eₐ e do fator pré-exponencial A.',
    theory: [
      'Pela teoria das colisões, só colisões com energia acima de um limiar e orientação adequada levam a produto. A fração de moléculas com energia suficiente segue aproximadamente exp(−Eₐ/RT).',
      'O gráfico de ln k contra 1/T é aproximadamente uma reta de inclinação −Eₐ/R. Curvatura indica dependência de Eₐ com a temperatura ou mudança de mecanismo.',
      'A unidade de k depende da ordem global da reação: s⁻¹ para primeira ordem e L·mol⁻¹·s⁻¹ para segunda ordem. A tem a mesma unidade de k.',
    ],
    equations: [
      { expr: 'k = A · exp(−Eₐ / RT)', tex: "k = A \\cdot \\exp\\!\\left(-\\dfrac{E_a}{RT}\\right)", meaning: 'equação de Arrhenius' },
      { expr: 'ln(k₂/k₁) = −(Eₐ/R)(1/T₂ − 1/T₁)', tex: "\\ln\\dfrac{k_2}{k_1} = -\\dfrac{E_a}{R}\\left(\\dfrac{1}{T_2} - \\dfrac{1}{T_1}\\right)", meaning: 'forma para dois pontos' },
    ],
    examples: ['Para Eₐ = 50 kJ/mol, aumentar a temperatura de 298 K para 308 K multiplica k por cerca de 1,9.'],
    applications: ['Prazo de validade de medicamentos', 'Projeto de reatores', 'Conservação de alimentos'],
    refs: ['atkinsPC', 'goldBook'],
    tool: { label: 'Calculadora de Arrhenius', to: '/calculator/arrhenius' },
  },
  {
    id: 'gibbs-equilibrio',
    area: 'fisicoquimica',
    title: 'Energia livre de Gibbs e equilíbrio',
    definition: 'A energia livre de Gibbs, G = H − TS, é o potencial termodinâmico cujo mínimo define o equilíbrio a temperatura e pressão constantes.',
    theory: [
      'Um processo a T e P constantes é espontâneo quando ΔG < 0. Espontaneidade não diz nada sobre velocidade: a conversão de diamante em grafite é espontânea, mas extremamente lenta.',
      'A relação ΔG° = −RT ln K liga dados termodinâmicos tabelados à constante de equilíbrio. Quando ΔH e ΔS têm o mesmo sinal, existe uma temperatura em que ΔG muda de sinal.',
    ],
    equations: [
      { expr: 'ΔG = ΔH − TΔS', tex: "\\Delta G = \\Delta H - T\\,\\Delta S", meaning: 'a T constante' },
      { expr: 'ΔG = ΔG° + RT ln Q', tex: "\\Delta G = \\Delta G^{\\circ} + RT \\ln Q", meaning: 'fora das condições padrão' },
      { expr: 'ΔG° = −RT ln K', tex: "\\Delta G^{\\circ} = -RT \\ln K", meaning: 'no equilíbrio (ΔG = 0, Q = K)' },
    ],
    examples: ['Fusão do gelo: ΔH > 0 e ΔS > 0, espontânea acima de 273 K a 1 atm.'],
    applications: ['Previsão de equilíbrios', 'Diagramas de Ellingham em metalurgia', 'Bioenergética'],
    refs: ['atkinsPC', 'greenBook'],
    tool: { label: 'Calculadora de Gibbs', to: '/calculator/gibbs' },
  },
  {
    id: 'nernst',
    area: 'fisicoquimica',
    title: 'Eletroquímica e equação de Nernst',
    definition: 'A equação de Nernst dá o potencial de uma célula ou eletrodo em função das atividades das espécies envolvidas.',
    theory: [
      'Ela decorre de ΔG = −zFE combinada com ΔG = ΔG° + RT ln Q. A 25 °C, o termo RT/F vale 25,69 mV; em base decimal, (RT ln 10)/F = 59,16 mV.',
      'Na prática, usa-se atividade ≈ concentração/c° em soluções diluídas. Para medidas precisas, coeficientes de atividade (Debye–Hückel) ou potenciais formais são necessários.',
    ],
    equations: [
      { expr: 'E = E° − (RT/zF) ln Q', tex: "E = E^{\\circ} - \\dfrac{RT}{zF} \\ln Q", meaning: 'equação de Nernst' },
      { expr: 'ΔG = −zFE', tex: "\\Delta G = -zFE", meaning: 'relação entre trabalho elétrico e energia livre' },
    ],
    examples: ['Eletrodo Cu²⁺/Cu (E° = +0,34 V) com [Cu²⁺] = 0,010 mol/L a 25 °C: E ≈ 0,34 − 0,0296 × 2 ≈ 0,28 V.'],
    applications: ['Eletrodos de pH e íon-seletivos', 'Baterias', 'Corrosão'],
    refs: ['atkinsPC', 'harris'],
    tool: { label: 'Calculadora de Nernst', to: '/calculator/nernst' },
  },
  {
    id: 'beer-lambert',
    area: 'analitica',
    title: 'Espectrofotometria e lei de Beer-Lambert',
    definition: 'A absorbância de uma solução é proporcional à concentração do absorvente e ao caminho óptico, para radiação monocromática.',
    theory: [
      'A lei vale para soluções diluídas (tipicamente abaixo de 0,01 mol/L), radiação monocromática e ausência de espalhamento, fluorescência ou equilíbrios químicos dependentes da concentração.',
      'Na prática, constrói-se uma curva de calibração com padrões e determina-se a concentração da amostra por interpolação, nunca por extrapolação.',
    ],
    equations: [
      { expr: 'A = ε · b · c', tex: "A = \\varepsilon \\cdot b \\cdot c", meaning: 'ε em L·mol⁻¹·cm⁻¹, b em cm, c em mol/L' },
      { expr: 'A = −log T = log(P₀/P)', tex: "A = -\\log T = \\log\\dfrac{P_0}{P}", meaning: 'absorbância e transmitância' },
    ],
    examples: ['Determinação de ferro com 1,10-fenantrolina em 510 nm.'],
    applications: ['Controle de qualidade', 'Análises ambientais', 'Bioquímica (proteínas em 280 nm)'],
    refs: ['skoog', 'harris'],
  },
  {
    id: 'titulacao',
    area: 'analitica',
    title: 'Titulação ácido-base',
    definition: 'Método volumétrico que determina a quantidade de um analito pela adição controlada de um titulante de concentração conhecida até a estequiometria ser atingida.',
    theory: [
      'O ponto de equivalência é teórico (quantidades estequiométricas); o ponto final é o observado (viragem do indicador ou inflexão da curva). A diferença é o erro de titulação.',
      'A escolha do indicador depende do pH no ponto de equivalência: ácido forte com base forte, pH 7; ácido fraco com base forte, pH acima de 7.',
      'Soluções de NaOH devem ser padronizadas (por exemplo, com hidrogenoftalato de potássio) porque o NaOH é higroscópico e absorve CO₂.',
    ],
    equations: [
      { expr: 'n_analito = (ν_analito/ν_titulante) · c_titulante · V_titulante', tex: "n_{\\text{analito}} = \\dfrac{\\nu_{\\text{analito}}}{\\nu_{\\text{titulante}}} \\cdot c_{\\text{titulante}} \\cdot V_{\\text{titulante}}", meaning: 'no ponto de equivalência' },
      { expr: 'pH = pKa + log([A⁻]/[HA])', tex: "\\mathrm{pH} = \\mathrm{p}K_a + \\log\\dfrac{[\\mathrm{A^-}]}{[\\mathrm{HA}]}", meaning: 'Henderson–Hasselbalch, na região tampão' },
    ],
    examples: ['Determinação de ácido acético em vinagre com NaOH padronizado e fenolftaleína.'],
    applications: ['Controle de qualidade', 'Análise de águas', 'Padronização de soluções'],
    refs: ['skoog', 'harris'],
    tool: { label: 'Calculadora de diluição', to: '/calculator/diluicao' },
  },
  {
    id: 'bragg',
    area: 'materiais',
    title: 'Estruturas cristalinas e difração de raios X',
    definition: 'A difração de raios X por planos cristalinos obedece à lei de Bragg e permite identificar fases, determinar parâmetros de rede e estimar tamanho de cristalito.',
    theory: [
      'Planos paralelos separados por d_hkl produzem interferência construtiva quando a diferença de caminho é um múltiplo inteiro do comprimento de onda.',
      'Para cristais cúbicos, d_hkl = a / √(h² + k² + l²). O conjunto de reflexões permitidas depende da rede de Bravais e do grupo espacial (regras de extinção).',
      'O alargamento dos picos relaciona-se ao tamanho de cristalito pela equação de Scherrer, válida aproximadamente para cristalitos abaixo de cerca de 100 nm.',
    ],
    equations: [
      { expr: 'nλ = 2 d sen θ', tex: "n\\lambda = 2d\\,\\operatorname{sen}\\theta", meaning: 'lei de Bragg' },
      { expr: 'τ = Kλ / (β cos θ)', tex: "\\tau = \\dfrac{K\\lambda}{\\beta\\cos\\theta}", meaning: 'Scherrer: β = largura a meia altura em radianos, K ≈ 0,9' },
    ],
    examples: ['Radiação Cu Kα (λ = 1,5406 Å) é a fonte mais comum em difratômetros de pó.'],
    applications: ['Identificação de fases', 'Cristalinidade de zeólitas e catalisadores', 'Controle de polimorfos em fármacos'],
    refs: ['callister', 'westSolid'],
  },
  {
    id: 'adsorcao-bet',
    area: 'materiais',
    title: 'Fisissorção e área superficial BET',
    definition: 'O método BET estima a área superficial específica de sólidos a partir de isotermas de adsorção física de gases, geralmente N₂ a 77 K.',
    theory: [
      'O modelo estende a teoria de Langmuir para multicamadas. A forma linearizada é válida, em geral, para pressões relativas entre 0,05 e 0,30, mas para materiais microporosos o intervalo deve ser escolhido pelos critérios de Rouquerol.',
      'A IUPAC classifica as isotermas (tipos I a VI) e os laços de histerese, que dão informação sobre micro, meso e macroporosidade.',
    ],
    equations: [
      { expr: '1 / [v((P₀/P) − 1)] = (c − 1)/(v_m c) · (P/P₀) + 1/(v_m c)', tex: "\\dfrac{1}{v\\left(\\dfrac{P_0}{P} - 1\\right)} = \\dfrac{c-1}{v_m c}\\cdot\\dfrac{P}{P_0} + \\dfrac{1}{v_m c}", meaning: 'forma linear de BET' },
      { expr: 'S = v_m · Nₐ · σ / V_mol', tex: "S = \\dfrac{v_m \\cdot N_A \\cdot \\sigma}{V_{\\text{mol}}}", meaning: 'área específica; σ(N₂) = 0,162 nm²' },
    ],
    examples: ['Isotermas do tipo I são típicas de sólidos microporosos, como zeólitas e carvões ativados.'],
    applications: ['Caracterização de catalisadores', 'Adsorventes', 'Materiais para armazenamento de gases'],
    refs: ['bet', 'thommes'],
  },
  {
    id: 'vidraria-volumetrica',
    area: 'experimental',
    title: 'Vidraria volumétrica e incertezas',
    definition: 'Vidraria volumétrica é calibrada para conter (TC) ou transferir (TD) um volume definido, com tolerância especificada por classe.',
    theory: [
      'Balões volumétricos, pipetas volumétricas e buretas de classe A têm as menores tolerâncias. Provetas e béqueres não servem para medidas exatas de volume.',
      'A leitura deve ser feita na parte inferior do menisco, com o olho na altura da marca, para evitar erro de paralaxe. A calibração vale para a temperatura gravada no vidro, geralmente 20 °C.',
      'A incerteza de um resultado combina as incertezas de massa, volume e pureza; em produtos e quocientes, as incertezas relativas se somam em quadratura.',
    ],
    equations: [{ expr: 'u_c(y)/y = √[(u(m)/m)² + (u(V)/V)² + …]', tex: "\\dfrac{u_c(y)}{y} = \\sqrt{\\left(\\dfrac{u(m)}{m}\\right)^2 + \\left(\\dfrac{u(V)}{V}\\right)^2 + \\cdots}", meaning: 'incerteza relativa combinada de y = m/V' }],
    examples: ['Uma pipeta volumétrica de 25 mL classe A costuma ter tolerância de ±0,03 mL.'],
    applications: ['Preparo de padrões', 'Titulações', 'Validação de métodos'],
    refs: ['harris', 'skoog'],
  },
  {
    id: 'preparo-solucoes',
    area: 'experimental',
    title: 'Preparo de soluções',
    definition: 'Preparar uma solução é dissolver quantidade conhecida de soluto e completar a um volume conhecido de solução, ou diluir uma solução estoque.',
    theory: [
      'Para soluções padrão primário, pesa-se o soluto seco em balança analítica, dissolve-se em parte do solvente, transfere-se quantitativamente para o balão e completa-se até a marca.',
      'Reagentes líquidos concentrados são especificados por título em massa (% m/m) e densidade; a concentração molar do reagente é c = 1000 · ρ · w / M (ρ em g/mL).',
      'Na diluição de ácidos fortes concentrados, adiciona-se sempre o ácido à água, lentamente e sob agitação, por causa do forte calor de diluição.',
    ],
    equations: [
      { expr: 'm = c · V · M / P', tex: "m = \\dfrac{c \\cdot V \\cdot M}{P}", meaning: 'massa de sólido de pureza P' },
      { expr: 'c₁V₁ = c₂V₂', tex: "c_1 V_1 = c_2 V_2", meaning: 'diluição' },
    ],
    examples: ['HCl 37 % (m/m), ρ = 1,19 g/mL: c ≈ 12,1 mol/L.'],
    applications: ['Preparo de reagentes', 'Curvas de calibração', 'Aulas experimentais'],
    refs: ['harris', 'vogel'],
    tool: { label: 'Calculadora de preparo de soluções', to: '/calculator/preparo-solucoes' },
  },
  {
    id: 'descritores',
    area: 'organica',
    title: 'Descritores moleculares: logP e TPSA',
    definition: 'Descritores moleculares são números calculados a partir da estrutura que resumem propriedades como lipofilicidade (logP) e polaridade de superfície (TPSA).',
    theory: [
      'LogP é o logaritmo do coeficiente de partição entre octanol e água. Métodos como Wildman–Crippen e XLogP3 o estimam somando contribuições de átomos ou fragmentos; são previsões e podem diferir do valor medido em mais de uma unidade.',
      'LogP não é uma medida de polaridade molecular nem de momento dipolar: uma molécula pode ter momento dipolar alto e ainda assim ser lipofílica.',
      'TPSA soma contribuições tabeladas de N, O e hidrogênios ligados a eles, calculadas a partir do grafo molecular, sem geometria 3D.',
    ],
    equations: [{ expr: 'logP = log([X]_octanol / [X]_água)', tex: "\\log P = \\log\\dfrac{[\\mathrm{X}]_{\\text{octanol}}}{[\\mathrm{X}]_{\\text{\u00e1gua}}}", meaning: 'para a forma neutra' }],
    examples: ['A regra dos cinco de Lipinski usa logP ≤ 5, massa ≤ 500, HBD ≤ 5 e HBA ≤ 10 como indicadores de absorção oral.'],
    applications: ['Química medicinal', 'Toxicologia ambiental', 'Triagem virtual'],
    refs: ['crippen', 'ertl', 'lipinski'],
    tool: { label: 'Propriedades químicas', to: '/properties' },
  },
];
