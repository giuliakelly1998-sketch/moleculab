# MOLECULAB | BYTE LAB

**Explore Chemistry at Molecular Scale.**
Plataforma web de exploração molecular e ferramentas químicas: busca na PubChem, visualização 2D/3D, propriedades com origem do dado, reconhecimento de grupos funcionais por SMARTS, 18 calculadoras com verificação dimensional e uma base de conhecimento com referências reais.

*Where Code Meets Chemistry.*

---

## Executar localmente

Requisitos: **Node.js 18.18+** (recomendado 20 ou 22) e npm.

```bash
npm install        # instala dependências e copia o RDKit (WebAssembly) para public/rdkit
npm run dev        # servidor de desenvolvimento em http://localhost:5173
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Executa os 129 testes (Vitest + Testing Library + RDKit real no Node) |
| `npm run typecheck` | Verificação de tipos TypeScript |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build em http://localhost:4173 |

O build usa caminhos relativos (`base: './'`) e roteamento por hash, então `dist/` funciona em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel, servidor da universidade) sem configuração extra. É preciso acesso à internet para consultar a PubChem; calculadoras, análise de SMILES e base de conhecimento funcionam offline depois de carregadas.

> Se `public/rdkit/` não existir (por exemplo, após instalar com `--ignore-scripts`), rode `node scripts/copy-rdkit.mjs`.

---

## Módulos

| Módulo | O que faz |
|---|---|
| **Overview** | Identidade, busca, moléculas em destaque, acesso aos módulos, últimas pesquisas e status dos serviços (latência da PubChem, RDKit, armazenamento local). |
| **Molecular Explorer** | Busca por nome, fórmula, SMILES, CID, CAS ou InChI (detecção automática com troca manual). Visualizador 3D (3Dmol.js): rotação, zoom, translação, ball-and-stick / stick / space-filling, hidrogênios, seleção de átomo com elemento, coordenadas, vizinhos, ordem e comprimento das ligações, exportação PNG. Vista 2D (RDKit). Painel com nome, fórmula, massa molar, átomos, ligações, SMILES, InChI, InChIKey e CID. Exporta JSON e SDF. |
| **Chemical Properties** | Massa molar, LogP, TPSA, doadores/aceptores de ligação de H, ligações rotacionáveis, solubilidade, pontos de fusão e ebulição, momento dipolar e área superficial. Cada valor traz unidade, explicação, fonte com link, método e natureza do dado. Exporta CSV, JSON e relatório HTML imprimível. |
| **Functional Groups** | 15 grupos reconhecidos por SMARTS no RDKit, com destaque dos átomos em 2D e 3D, contagem de ocorrências, ficha de cada grupo (estrutura geral, nomenclatura, características, propriedades, exemplos) e campo para testar qualquer SMILES localmente. |
| **Chemistry Calculator** | Estequiometria (massa↔mol, partículas, massa molar com composição, relações estequiométricas, reagente limitante, rendimento), Soluções (concentração molar, diluição, concentração comum, conversão de unidades, preparo a partir de sólido ou de reagente concentrado) e Físico-química (Arrhenius, energia de ativação, gases ideais, Nernst, Gibbs, Clausius-Clapeyron). Cada uma mostra equação, unidades, substituição, conversões para o SI, resultado, explicação das variáveis e verificação dimensional; Arrhenius e Clausius-Clapeyron têm gráfico (Plotly). |
| **Periodic Table** | Tabela periódica clicável (colorir por categoria, eletronegatividade, raio, ionização, densidade ou PF) e página de cada um dos 118 elementos: elétrons/prótons/nêutrons, camadas (diagrama de Bohr), quadro de propriedades com seletores de variante e unidade, propriedades termodinâmicas, atômicas (configuração, estados de oxidação, todas as energias de ionização, cinco tipos de raio), eletromagnéticas, mecânicas, reatividade, isótopos e abundância. **Célula unitária 3D** (CS, CCC, CFC, diamante e HC) com arestas rotuladas, esferas reduzidas ou em contato, vizinhos mais próximos, fator de empacotamento e densidade teórica comparada à medida. |
| **Knowledge Base** | 16 tópicos nas 7 áreas pedidas, cada um com definição, fundamentação, equações, exemplos, aplicações e referências bibliográficas verificáveis. |
| **Favorites** | Moléculas salvas e histórico de pesquisas, com exportação JSON/CSV. |
| **Settings** | Tema escuro/claro, representação 3D padrão, hidrogênios, autocompletar, histórico, limpeza de cache/favoritos/histórico. |

---

## Confiabilidade científica

O sistema nunca preenche um campo com valor inventado. Cada dado recebe um selo:

| Selo | Significado | Exemplos |
|---|---|---|
| **experimental** | Valor medido, depositado por fonte identificada | Pontos de fusão/ebulição, solubilidade (anotações PubChem PUG View, com a fonte original de cada valor) |
| **calculado** | Determinístico a partir da estrutura | Massa molar, TPSA, contagens de doadores/aceptores e ligações rotacionáveis |
| **estimado** | Previsão de modelo empírico | LogP (XLogP3 da PubChem e Wildman–Crippen do RDKit), área superficial de Labute |
| **indisponível** | Nenhuma fonte forneceu o valor | Exibido como tal, sem estimativa substituta |

Outras decisões:

- **LogP não é polaridade.** A interface explica a diferença; momento dipolar é tratado separadamente.
- **Momento dipolar não é estimado.** Exige medida ou cálculo de estrutura eletrônica; só aparecem valores experimentais depositados.
- **Conformações 3D** são as conformações calculadas pela PubChem (não experimentais). O app informa a origem; quando só há coordenadas 2D, avisa que a estrutura plana não é uma geometria otimizada.
- **Quando PubChem e RDKit divergem** (ex.: ligações rotacionáveis), os dois valores aparecem com seus métodos.
- **Massas atômicas**: IUPAC/CIAAW 2021 (valores convencionais). **Constantes**: CODATA 2018 (R, Nₐ, F).

---

## Arquitetura

```
src/
├── App.tsx                      # rotas e providers (sem lógica de domínio)
├── main.tsx
├── calc/                        # cálculos puros, sem React
│   ├── quantity.ts              # grandezas com vetor dimensional [L M T N Θ I]
│   ├── units.ts                 # unidades e conversões para o SI
│   ├── stoichiometry.ts · solutions.ts · physchem.ts
│   └── calculators.ts           # definições declarativas das 18 calculadoras
├── chem/                        # processamento químico
│   ├── elements.ts              # massas atômicas IUPAC 2021, nomes em português
│   ├── formula.ts               # parser de fórmulas (parênteses, colchetes, hidratos)
│   ├── functionalGroups.ts      # padrões SMARTS e detecção
│   ├── analysis.ts              # descritores RDKit, desenho 2D com destaque
│   ├── propertyCatalog.ts       # metadados e natureza de cada propriedade
│   ├── queryDetect.ts           # detecção do tipo de consulta, validação CAS/SMILES
│   ├── sdf.ts                   # leitor de molfile V2000
│   └── molecule.ts              # tipos do domínio
├── services/                    # integração externa e infraestrutura
│   ├── http.ts                  # limite de taxa, deduplicação, timeout, novas tentativas
│   ├── cache.ts                 # cache memória + localStorage com validade
│   ├── storage.ts               # acesso seguro ao localStorage
│   ├── pubchem.ts               # PUG REST + PUG View
│   ├── autocomplete.ts          # sugestões de nomes (PubChem)
│   ├── moleculeService.ts       # orquestra a busca e monta o registro
│   ├── rdkit.ts                 # carregamento do WASM e saneamento de SMILES
│   └── errors.ts                # erros com mensagem para o usuário
├── state/                       # estado global (React Context)
├── hooks/                       # useDebounce, useRDKit
├── components/                  # layout, UI, busca, desenho 2D, ErrorBoundary
├── modules/                     # uma pasta por módulo (página + CSS Module)
├── data/                        # base de conhecimento e referências
└── utils/                       # formatação pt-BR, exportadores
tests/                           # 9 arquivos, 129 testes
```

**Desempenho e segurança**

- Debounce de 350 ms no autocompletar; busca repetida não dispara nova chamada (cache de 24 h).
- No máximo 4 requisições/s à PubChem (a política pede ≤ 5), deduplicação de chamadas simultâneas, timeout de 20 s, nova tentativa com espera exponencial em 503/429 e falhas de rede.
- Módulos carregados por rota (code splitting); 3Dmol.js, Plotly e RDKit só são carregados quando usados.
- Visualizador 3D verifica WebGL e mostra alternativa 2D se a inicialização falhar; ErrorBoundary isola falhas por módulo.
- SMILES do usuário: limite de tamanho, lista de caracteres permitidos, interpretação e sanitização pelo RDKit e limite de 500 átomos pesados antes de qualquer uso; só a forma canônica é enviada à PubChem.
- Nenhuma chave secreta no frontend (a PubChem é pública). Dados locais validados ao ler; o usuário pode apagar tudo em Settings.

---

## Testes

```bash
npm test
```

Cobrem cálculos estequiométricos, diluições, massa molar, equações físico-químicas (comparadas com valores de referência como 22,414 L/mol, RT/F = 25,69 mV e o potencial do eletrodo de cobre), análise dimensional e unidades, reconhecimento de grupos funcionais com o RDKit real (27 moléculas, incluindo casos de confusão como fenol × álcool e éster × éter), detecção de tipo de consulta e CAS, consulta de moléculas com a PubChem simulada (cache, erro 404, 503 com nova tentativa, falha de rede, isômeros), leitura de dados PUG View e componentes essenciais (calculadoras, validação, base de conhecimento).

---

## Limitações conhecidas

- **Resolução de CAS** depende dos sinônimos depositados na PubChem; não há serviço oficial gratuito do CAS. O app valida o dígito verificador antes de consultar.
- **Estruturas fora da PubChem** (SMILES novos) têm só coordenadas 2D: o RDKit em WebAssembly (build *minimal*) não gera conformações 3D.
- **Elementos**: dados de `src/data/elements.json`, gerado por `scripts/build-elements.py` a partir do mendeleev (referências primárias por propriedade, como CRC Handbook 95ª ed., Slater 1964, Pyykkö 2009) e do pymatgen (compilado do WebElements). Suscetibilidade magnética, temperatura de Debye, espectro de emissão, NFPA e abundância no universo/Sol não estão nessas bases e não são exibidos. A relação c/a das estruturas HC também não está na base: o desenho usa o valor ideal √(8/3) e a densidade teórica dessas estruturas é marcada como estimada. Estruturas ortorrômbicas, tetragonais, romboédricas, monoclínicas e cúbicas complexas são informadas, mas não desenhadas.
- **Ângulos de ligação** são medidos na conformação 3D calculada pela PubChem (geometria teórica).
- **Grupos funcionais**: os SMARTS cobrem a química orgânica introdutória. Anidridos, carbonatos, ureias e haletos de acila são classificados de forma aproximada ou não reconhecidos.
- **Destaque 3D** de grupos funcionais exige que os átomos pesados venham antes dos hidrogênios no arquivo de estrutura (o padrão da PubChem). Caso contrário, o destaque fica disponível só no 2D, e o app avisa.
- **Dados experimentais** são reproduzidos como depositados, com condições e unidades originais; fontes diferentes podem divergir.
- **Clausius-Clapeyron, Nernst e gases ideais** são modelos idealizados; as notas de cada calculadora explicam as suposições.
- Durante o desenvolvimento, a integração com a PubChem foi testada com respostas simuladas no formato oficial da API (o ambiente de build não tinha acesso à internet). Se a PubChem mudar nomes de campos, `services/pubchem.ts` já trata a mudança de 2025 nos campos de SMILES.

---

## Fontes de dados e bibliotecas

- **PubChem** (NCBI/NIH) — PUG REST e PUG View. Kim, S. et al. *Nucleic Acids Res.* 51, D1373 (2023).
- **RDKit** (WebAssembly, `@rdkit/rdkit`) — descritores, SMARTS, desenho 2D, InChI.
- **3Dmol.js** — Rego, N.; Koes, D. *Bioinformatics* 31, 1322 (2015).
- **Plotly.js** (pacote *basic*) — gráficos.
- **React 18, TypeScript, Vite 6, React Router**.

© BYTE LAB — MOLECULAB.
