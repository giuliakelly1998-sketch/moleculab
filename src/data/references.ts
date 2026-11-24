/**
 * Referências bibliográficas reais usadas na base de conhecimento.
 * Livros-texto consagrados, artigos revisados por pares e fontes institucionais.
 */
export interface Reference {
  id: string;
  text: string;
  url?: string;
}

export const REFS: Record<string, Reference> = {
  atkinsPC: { id: 'atkinsPC', text: 'ATKINS, P.; DE PAULA, J.; KEELER, J. Atkins’ Physical Chemistry. 11. ed. Oxford: Oxford University Press, 2018.' },
  atkinsPrinciples: { id: 'atkinsPrinciples', text: 'ATKINS, P.; JONES, L.; LAVERMAN, L. Chemical Principles: the quest for insight. 7. ed. New York: W. H. Freeman, 2016.' },
  clayden: { id: 'clayden', text: 'CLAYDEN, J.; GREEVES, N.; WARREN, S. Organic Chemistry. 2. ed. Oxford: Oxford University Press, 2012.' },
  weller: { id: 'weller', text: 'WELLER, M.; OVERTON, T.; ROURKE, J.; ARMSTRONG, F. Inorganic Chemistry. 7. ed. Oxford: Oxford University Press, 2018.' },
  housecroft: { id: 'housecroft', text: 'HOUSECROFT, C. E.; SHARPE, A. G. Inorganic Chemistry. 5. ed. Harlow: Pearson, 2018.' },
  skoog: { id: 'skoog', text: 'SKOOG, D. A.; WEST, D. M.; HOLLER, F. J.; CROUCH, S. R. Fundamentals of Analytical Chemistry. 9. ed. Belmont: Brooks/Cole, Cengage Learning, 2014.' },
  harris: { id: 'harris', text: 'HARRIS, D. C. Quantitative Chemical Analysis. 9. ed. New York: W. H. Freeman, 2015.' },
  callister: { id: 'callister', text: 'CALLISTER, W. D.; RETHWISCH, D. G. Materials Science and Engineering: an introduction. 10. ed. Hoboken: Wiley, 2018.' },
  westSolid: { id: 'westSolid', text: 'WEST, A. R. Solid State Chemistry and its Applications. 2. ed. Chichester: Wiley, 2014.' },
  bet: { id: 'bet', text: 'BRUNAUER, S.; EMMETT, P. H.; TELLER, E. Adsorption of gases in multimolecular layers. Journal of the American Chemical Society, v. 60, n. 2, p. 309–319, 1938.', url: 'https://doi.org/10.1021/ja01269a023' },
  thommes: { id: 'thommes', text: 'THOMMES, M. et al. Physisorption of gases, with special reference to the evaluation of surface area and pore size distribution (IUPAC Technical Report). Pure and Applied Chemistry, v. 87, n. 9-10, p. 1051–1069, 2015.', url: 'https://doi.org/10.1515/pac-2014-1117' },
  vogel: { id: 'vogel', text: 'FURNISS, B. S.; HANNAFORD, A. J.; SMITH, P. W. G.; TATCHELL, A. R. Vogel’s Textbook of Practical Organic Chemistry. 5. ed. Harlow: Longman, 1989.' },
  greenBook: { id: 'greenBook', text: 'COHEN, E. R. et al. Quantities, Units and Symbols in Physical Chemistry (IUPAC Green Book). 3. ed. Cambridge: RSC Publishing, 2007.' },
  goldBook: { id: 'goldBook', text: 'IUPAC. Compendium of Chemical Terminology (Gold Book). Versão online.', url: 'https://goldbook.iupac.org' },
  codata: { id: 'codata', text: 'TIESINGA, E. et al. CODATA recommended values of the fundamental physical constants: 2018. Reviews of Modern Physics, v. 93, 025010, 2021.', url: 'https://doi.org/10.1103/RevModPhys.93.025010' },
  ciaaw: { id: 'ciaaw', text: 'IUPAC/CIAAW. Standard Atomic Weights.', url: 'https://www.ciaaw.org/atomic-weights.htm' },
  ertl: { id: 'ertl', text: 'ERTL, P.; ROHDE, B.; SELZER, P. Fast calculation of molecular polar surface area as a sum of fragment-based contributions. Journal of Medicinal Chemistry, v. 43, n. 20, p. 3714–3717, 2000.', url: 'https://doi.org/10.1021/jm000942e' },
  crippen: { id: 'crippen', text: 'WILDMAN, S. A.; CRIPPEN, G. M. Prediction of physicochemical parameters by atomic contributions. Journal of Chemical Information and Computer Sciences, v. 39, n. 5, p. 868–873, 1999.', url: 'https://doi.org/10.1021/ci990307l' },
  lipinski: { id: 'lipinski', text: 'LIPINSKI, C. A. et al. Experimental and computational approaches to estimate solubility and permeability in drug discovery and development settings. Advanced Drug Delivery Reviews, v. 23, p. 3–25, 1997.', url: 'https://doi.org/10.1016/S0169-409X(96)00423-1' },
  pubchem: { id: 'pubchem', text: 'KIM, S. et al. PubChem 2023 update. Nucleic Acids Research, v. 51, n. D1, p. D1373–D1380, 2023.', url: 'https://doi.org/10.1093/nar/gkac956' },
  smarts: { id: 'smarts', text: 'DAYLIGHT CHEMICAL INFORMATION SYSTEMS. SMARTS — A Language for Describing Molecular Patterns. Theory Manual.', url: 'https://www.daylight.com/dayhtml/doc/theory/theory.smarts.html' },
};
