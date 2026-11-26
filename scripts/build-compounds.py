"""Gera src/data/compounds.json: biblioteca local de compostos comuns no ensino de Química.

Para cada composto: nomes (pt/en e sinônimos), SMILES, fórmula e massa calculadas pelo
RDKit e uma conformação 3D (ETKDGv3 + otimização MMFF94; UFF se MMFF não se aplicar).
Usada quando a PubChem não está acessível e para aceitar nomes em português.
Estereocentros conferidos por CIP (R/S) contra a literatura nos casos marcados.
"""
import json, pathlib
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
from rdkit.Chem import rdCIPLabeler

# (nome pt, [sinônimos pt/en...], smiles, CIP esperado opcional {indice_mapeado: 'R'/'S'} via string "R,S,..." na ordem dos átomos)
C = [
 # Substâncias inorgânicas e moléculas pequenas
 ("Água", ["water","h2o"], "O", None),
 ("Peróxido de hidrogênio", ["água oxigenada","hydrogen peroxide"], "OO", None),
 ("Amônia", ["amoníaco","ammonia"], "N", None),
 ("Dióxido de carbono", ["gás carbônico","carbon dioxide"], "O=C=O", None),
 ("Monóxido de carbono", ["carbon monoxide"], "[C-]#[O+]", None),
 ("Oxigênio", ["gás oxigênio","oxygen","dioxigênio"], "O=O", None),
 ("Ozônio", ["ozone"], "[O-][O+]=O", None),
 ("Nitrogênio", ["gás nitrogênio","nitrogen","dinitrogênio"], "N#N", None),
 ("Hidrogênio", ["gás hidrogênio","hydrogen","di-hidrogênio"], "[H][H]", None),
 ("Cloro", ["gás cloro","chlorine"], "ClCl", None),
 ("Cloreto de hidrogênio", ["ácido clorídrico","hydrogen chloride","hydrochloric acid"], "Cl", None),
 ("Fluoreto de hidrogênio", ["ácido fluorídrico","hydrogen fluoride"], "F", None),
 ("Sulfeto de hidrogênio", ["gás sulfídrico","hydrogen sulfide"], "S", None),
 ("Dióxido de enxofre", ["sulfur dioxide"], "O=S=O", None),
 ("Trióxido de enxofre", ["sulfur trioxide"], "O=S(=O)=O", None),
 ("Cianeto de hidrogênio", ["ácido cianídrico","hydrogen cyanide"], "C#N", None),
 ("Ácido sulfúrico", ["sulfuric acid"], "OS(=O)(=O)O", None),
 ("Ácido nítrico", ["nitric acid"], "O[N+](=O)[O-]", None),
 ("Ácido fosfórico", ["phosphoric acid","ácido ortofosfórico"], "OP(=O)(O)O", None),
 ("Ácido carbônico", ["carbonic acid"], "OC(=O)O", None),
 ("Cloreto de sódio", ["sal de cozinha","sodium chloride","nacl"], "[Na+].[Cl-]", None),
 ("Hidróxido de sódio", ["soda cáustica","sodium hydroxide","naoh"], "[Na+].[OH-]", None),
 ("Carbonato de cálcio", ["calcium carbonate","calcário"], "[Ca+2].[O-]C([O-])=O", None),
 ("Bicarbonato de sódio", ["hidrogenocarbonato de sódio","sodium bicarbonate"], "[Na+].OC([O-])=O", None),
 ("Sulfato de cobre(II)", ["sulfato de cobre","copper sulfate"], "[Cu+2].[O-]S([O-])(=O)=O", None),
 ("Nitrato de prata", ["silver nitrate"], "[Ag+].[O-][N+]([O-])=O", None),
 ("Permanganato de potássio", ["potassium permanganate"], "[K+].[O-][Mn](=O)(=O)=O", None),
 # Hidrocarbonetos
 ("Metano", ["methane"], "C", None),
 ("Etano", ["ethane"], "CC", None),
 ("Propano", ["propane"], "CCC", None),
 ("Butano", ["butane","n-butano"], "CCCC", None),
 ("Isobutano", ["metilpropano","2-metilpropano","isobutane"], "CC(C)C", None),
 ("Pentano", ["pentane"], "CCCCC", None),
 ("Hexano", ["hexane","n-hexano"], "CCCCCC", None),
 ("Heptano", ["heptane"], "CCCCCCC", None),
 ("Octano", ["octane","n-octano"], "CCCCCCCC", None),
 ("Isoctano", ["2,2,4-trimetilpentano","isooctane"], "CC(C)CC(C)(C)C", None),
 ("Ciclopropano", ["cyclopropane"], "C1CC1", None),
 ("Ciclo-hexano", ["cicloexano","cyclohexane"], "C1CCCCC1", None),
 ("Eteno", ["etileno","ethylene","ethene"], "C=C", None),
 ("Propeno", ["propileno","propene","propylene"], "CC=C", None),
 ("Buta-1,3-dieno", ["butadieno","1,3-butadiene"], "C=CC=C", None),
 ("Etino", ["acetileno","acetylene","ethyne"], "C#C", None),
 ("Benzeno", ["benzene"], "c1ccccc1", None),
 ("Tolueno", ["metilbenzeno","toluene"], "Cc1ccccc1", None),
 ("o-Xileno", ["1,2-dimetilbenzeno","o-xylene"], "Cc1ccccc1C", None),
 ("Estireno", ["vinilbenzeno","styrene"], "C=Cc1ccccc1", None),
 ("Naftaleno", ["naftalina","naphthalene"], "c1ccc2ccccc2c1", None),
 ("Antraceno", ["anthracene"], "c1ccc2cc3ccccc3cc2c1", None),
 ("Limoneno", ["limonene"], "CC1=CCC(CC1)C(C)=C", None),
 # Haletos
 ("Clorometano", ["cloreto de metila","chloromethane"], "CCl", None),
 ("Diclorometano", ["cloreto de metileno","dichloromethane"], "ClCCl", None),
 ("Clorofórmio", ["triclorometano","chloroform"], "ClC(Cl)Cl", None),
 ("Tetracloreto de carbono", ["tetraclorometano","carbon tetrachloride"], "ClC(Cl)(Cl)Cl", None),
 ("Cloreto de vinila", ["cloroeteno","vinyl chloride"], "C=CCl", None),
 ("Clorobenzeno", ["chlorobenzene"], "Clc1ccccc1", None),
 ("Bromoetano", ["brometo de etila","bromoethane"], "CCBr", None),
 # Álcoois, fenóis, éteres
 ("Metanol", ["álcool metílico","methanol"], "CO", None),
 ("Etanol", ["álcool etílico","álcool","ethanol"], "CCO", None),
 ("Propan-1-ol", ["1-propanol","propanol","propan-1-ol"], "CCCO", None),
 ("Propan-2-ol", ["isopropanol","álcool isopropílico","2-propanol","isopropyl alcohol"], "CC(C)O", None),
 ("Butan-1-ol", ["1-butanol","butanol"], "CCCCO", None),
 ("terc-Butanol", ["2-metilpropan-2-ol","tert-butanol","terc-butílico"], "CC(C)(C)O", None),
 ("Etilenoglicol", ["etano-1,2-diol","ethylene glycol"], "OCCO", None),
 ("Glicerol", ["glicerina","propano-1,2,3-triol","glycerol"], "OCC(O)CO", None),
 ("Fenol", ["ácido fênico","phenol","hidroxibenzeno"], "Oc1ccccc1", None),
 ("Éter dietílico", ["etoxietano","éter etílico","diethyl ether"], "CCOCC", None),
 ("Éter dimetílico", ["metoximetano","dimethyl ether"], "COC", None),
 ("Tetra-hidrofurano", ["thf","tetrahydrofuran"], "C1CCOC1", None),
 ("Mentol", ["menthol"], "CC(C)C1CCC(C)CC1O", None),
 # Aldeídos e cetonas
 ("Metanal", ["formaldeído","formol","formaldehyde"], "C=O", None),
 ("Etanal", ["acetaldeído","acetaldehyde"], "CC=O", None),
 ("Benzaldeído", ["benzaldehyde"], "O=Cc1ccccc1", None),
 ("Cinamaldeído", ["aldeído cinâmico","cinnamaldehyde"], "O=C/C=C/c1ccccc1", None),
 ("Vanilina", ["vanillin"], "COc1cc(C=O)ccc1O", None),
 ("Propanona", ["acetona","acetone","dimetilcetona"], "CC(C)=O", None),
 ("Butanona", ["metiletilcetona","butan-2-ona","mek","butanone"], "CCC(C)=O", None),
 ("Acetofenona", ["1-feniletanona","acetophenone"], "CC(=O)c1ccccc1", None),
 ("Ciclo-hexanona", ["cicloexanona","cyclohexanone"], "O=C1CCCCC1", None),
 # Ácidos carboxílicos e derivados
 ("Ácido metanoico", ["ácido fórmico","formic acid"], "OC=O", None),
 ("Ácido etanoico", ["ácido acético","vinagre","acetic acid"], "CC(=O)O", None),
 ("Ácido propanoico", ["ácido propiônico","propanoic acid"], "CCC(=O)O", None),
 ("Ácido butanoico", ["ácido butírico","butyric acid"], "CCCC(=O)O", None),
 ("Ácido oxálico", ["ácido etanodioico","oxalic acid"], "OC(=O)C(=O)O", None),
 ("Ácido lático", ["ácido láctico","ácido 2-hidroxipropanoico","lactic acid"], "CC(O)C(=O)O", None),
 ("Ácido cítrico", ["citric acid"], "OC(=O)CC(O)(CC(=O)O)C(=O)O", None),
 ("Ácido benzoico", ["benzoic acid"], "OC(=O)c1ccccc1", None),
 ("Ácido salicílico", ["ácido 2-hidroxibenzoico","salicylic acid"], "OC(=O)c1ccccc1O", None),
 ("Ácido esteárico", ["ácido octadecanoico","stearic acid"], "CCCCCCCCCCCCCCCCCC(=O)O", None),
 ("Ácido oleico", ["oleic acid"], "CCCCCCCC/C=C\\CCCCCCCC(=O)O", None),
 ("Ácido L-ascórbico", ["vitamina c","ácido ascórbico","ascorbic acid","vitamin c"], "OC[C@H](O)[C@H]1OC(=O)C(O)=C1O", "S,R"),
 ("Acetato de etila", ["etanoato de etila","ethyl acetate"], "CCOC(C)=O", None),
 ("Acetato de isoamila", ["acetato de isopentila","essência de banana","isoamyl acetate"], "CC(C)CCOC(C)=O", None),
 ("Salicilato de metila", ["óleo de gaultéria","methyl salicylate"], "COC(=O)c1ccccc1O", None),
 ("Benzoato de sódio", ["sodium benzoate"], "[Na+].[O-]C(=O)c1ccccc1", None),
 # Compostos nitrogenados e sulfurados
 ("Metilamina", ["metanamina","methylamine"], "CN", None),
 ("Dimetilamina", ["dimethylamine"], "CNC", None),
 ("Trimetilamina", ["trimethylamine"], "CN(C)C", None),
 ("Anilina", ["fenilamina","aminobenzeno","aniline"], "Nc1ccccc1", None),
 ("Nitrobenzeno", ["nitrobenzene"], "O=[N+]([O-])c1ccccc1", None),
 ("Ureia", ["carbamida","urea"], "NC(N)=O", None),
 ("Acetamida", ["etanamida","acetamide"], "CC(N)=O", None),
 ("Acetonitrila", ["etanonitrila","cianeto de metila","acetonitrile"], "CC#N", None),
 ("Dimetilformamida", ["dmf","n,n-dimetilformamida","dimethylformamide"], "CN(C)C=O", None),
 ("Dimetilsulfóxido", ["dmso","dimethyl sulfoxide"], "CS(C)=O", None),
 ("EDTA", ["ácido etilenodiaminotetracético","edetic acid"], "OC(=O)CN(CCN(CC(=O)O)CC(=O)O)CC(=O)O", None),
 # Heterociclos e bases nitrogenadas
 ("Piridina", ["pyridine"], "c1ccncc1", None),
 ("Pirrol", ["pyrrole"], "c1cc[nH]c1", None),
 ("Furano", ["furan"], "c1ccoc1", None),
 ("Tiofeno", ["thiophene"], "c1ccsc1", None),
 ("Imidazol", ["imidazole"], "c1c[nH]cn1", None),
 ("Indol", ["indole"], "c1ccc2[nH]ccc2c1", None),
 ("Adenina", ["adenine"], "Nc1ncnc2[nH]cnc12", None),
 ("Guanina", ["guanine"], "Nc1nc2[nH]cnc2c(=O)[nH]1", None),
 ("Citosina", ["cytosine"], "Nc1cc[nH]c(=O)n1", None),
 ("Timina", ["thymine"], "Cc1c[nH]c(=O)[nH]c1=O", None),
 ("Uracila", ["uracil"], "O=c1cc[nH]c(=O)[nH]1", None),
 # Carboidratos (forma de cadeia aberta para as aldoses/cetoses; estereoquímica conferida por CIP)
 ("D-Glicose", ["glicose","dextrose","glucose","d-glucose"], "O=C[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO", "R,S,R,R"),
 ("D-Frutose", ["frutose","fructose","levulose"], "OCC(=O)[C@@H](O)[C@H](O)[C@H](O)CO", "S,R,R"),
 ("D-Galactose", ["galactose"], "O=C[C@H](O)[C@@H](O)[C@@H](O)[C@H](O)CO", "R,S,S,R"),
 ("D-Ribose", ["ribose"], "O=C[C@H](O)[C@H](O)[C@H](O)CO", "R,R,R"),
 ("Sacarose", ["açúcar","açúcar comum","sucrose"], "OC[C@H]1O[C@H](O[C@]2(CO)O[C@H](CO)[C@@H](O)[C@@H]2O)[C@H](O)[C@@H](O)[C@@H]1O", None),
 # Aminoácidos (forma L; estereocentro conferido por CIP)
 ("Glicina", ["glycine","gly"], "NCC(=O)O", None),
 ("L-Alanina", ["alanina","alanine","ala"], "C[C@H](N)C(=O)O", "S"),
 ("L-Valina", ["valina","valine","val"], "CC(C)[C@H](N)C(=O)O", "S"),
 ("L-Leucina", ["leucina","leucine","leu"], "CC(C)C[C@H](N)C(=O)O", "S"),
 ("L-Serina", ["serina","serine","ser"], "N[C@@H](CO)C(=O)O", "S"),
 ("L-Cisteína", ["cisteína","cysteine","cys"], "N[C@@H](CS)C(=O)O", "R"),
 ("L-Fenilalanina", ["fenilalanina","phenylalanine","phe"], "N[C@@H](Cc1ccccc1)C(=O)O", "S"),
 ("L-Tirosina", ["tirosina","tyrosine","tyr"], "N[C@@H](Cc1ccc(O)cc1)C(=O)O", "S"),
 ("L-Triptofano", ["triptofano","tryptophan","trp"], "N[C@@H](Cc1c[nH]c2ccccc12)C(=O)O", "S"),
 ("Ácido L-glutâmico", ["ácido glutâmico","glutamato","glutamic acid","glu"], "N[C@@H](CCC(=O)O)C(=O)O", "S"),
 ("L-Lisina", ["lisina","lysine","lys"], "NCCCC[C@H](N)C(=O)O", "S"),
 # Fármacos e substâncias do cotidiano
 ("Ácido acetilsalicílico", ["aspirina","aas","aspirin","acetylsalicylic acid"], "CC(=O)Oc1ccccc1C(=O)O", None),
 ("Paracetamol", ["acetaminofeno","acetaminophen","tylenol"], "CC(=O)Nc1ccc(O)cc1", None),
 ("Ibuprofeno", ["ibuprofen"], "CC(C)Cc1ccc(cc1)C(C)C(=O)O", None),
 ("Cafeína", ["caffeine","1,3,7-trimetilxantina"], "Cn1cnc2c1c(=O)n(C)c(=O)n2C", None),
 ("Teobromina", ["theobromine"], "Cn1cnc2c1c(=O)[nH]c(=O)n2C", None),
 ("Nicotina", ["nicotine"], "CN1CCC[C@H]1c1cccnc1", "S"),
 ("Dopamina", ["dopamine"], "NCCc1ccc(O)c(O)c1", None),
 ("Serotonina", ["5-hidroxitriptamina","serotonin"], "NCCc1c[nH]c2ccc(O)cc12", None),
 ("Adrenalina", ["epinefrina","epinephrine","adrenaline"], "CNC[C@H](O)c1ccc(O)c(O)c1", "R"),
 ("Histamina", ["histamine"], "NCCc1c[nH]cn1", None),
 ("Benzocaína", ["benzocaine"], "CCOC(=O)c1ccc(N)cc1", None),
 ("Lidocaína", ["xilocaína","lidocaine"], "CCN(CC)CC(=O)Nc1c(C)cccc1C", None),
 ("Capsaicina", ["capsaicin"], "COc1cc(CNC(=O)CCCC/C=C/C(C)C)ccc1O", None),
 ("Eugenol", ["óleo de cravo","eugenol"], "COc1cc(CC=C)ccc1O", None),
 ("Fenolftaleína", ["phenolphthalein"], "O=C1OC(c2ccccc21)(c1ccc(O)cc1)c1ccc(O)cc1", None),
]

OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "compounds.json"
rows = []
for pt, syn, smi, cip in C:
    m = Chem.MolFromSmiles(smi)
    assert m is not None, pt
    if cip:
        rdCIPLabeler.AssignCIPLabels(m)
        labels = [a.GetProp('_CIPCode') for a in m.GetAtoms() if a.HasProp('_CIPCode')]
        assert labels == cip.split(','), (pt, labels, cip)
    can = Chem.MolToSmiles(m)
    formula = rdMolDescriptors.CalcMolFormula(m)
    mw = Descriptors.MolWt(m)
    mh = Chem.AddHs(m)
    mol3d = None
    if mh.GetNumAtoms() > 1:
        p = AllChem.ETKDGv3(); p.randomSeed = 7
        if AllChem.EmbedMolecule(mh, p) == 0:
            try:
                if AllChem.MMFFHasAllMoleculeParams(mh):
                    AllChem.MMFFOptimizeMolecule(mh, maxIters=2000)
                else:
                    AllChem.UFFOptimizeMolecule(mh, maxIters=2000)
            except Exception:
                pass
            mol3d = Chem.MolToMolBlock(mh)
            mol3d = "\n".join(mol3d.split("\n")[1:])  # tira a linha de nome
            mol3d = pt + "\n" + mol3d
    rows.append({"pt": pt, "names": syn, "smiles": can, "formula": formula, "mw": round(mw, 3), "molblock3d": mol3d})
    print(f"{pt:32s} {formula:14s} {mw:8.3f} {'3D' if mol3d else '--'}")
OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
print(len(rows), "compostos;", OUT.stat().st_size // 1024, "KB")
