# Ferme — cycle complet

Un petit simulateur de ferme en 3D isométrique qui tourne dans le navigateur, sans
build ni serveur : un fichier HTML, three.js embarqué, et c'est tout.

Tu conduis toute la saison sur une parcelle unique :

1. **Préparer** — la déchaumeuse ouvre le sol.
2. **Semer** — le semoir met la culture en terre (la semence se paie).
3. **Engrais** — le pulvérisateur rampes déployées accélère fortement la pousse.
4. **Pousse** — le blé, le colza ou le maïs mûrit ; la pluie aide.
5. **Moisson** — la moissonneuse coupe, la benne fait la navette jusqu'au silo, le silo paie.

## Jouer

Ouvre `index.html` derrière un serveur statique (le service worker et le
manifeste ont besoin de `http(s)://`) :

```sh
python3 -m http.server 8000
# puis http://localhost:8000
```

Un simple double-clic sur le fichier marche aussi : le jeu fonctionne, seul
l'ajout à l'écran d'accueil est perdu.

### Commandes

| Touche | Effet |
| --- | --- |
| `Z Q S D` / `W A S D` / flèches | piloter — la direction donne le cap, la pression la vitesse |
| `Espace` | freiner |
| `V` | pilote automatique (l'engin fait ses passages tout seul) |
| `G` | changer de mode de pilotage |
| `1` `2` `3` `4` | sol · semis · engrais · moisson |
| `X` | accélérer le temps ×1 ×3 ×6 |
| `B` `C` `H` | boutique · cultures · aide |
| `N` | couper le son |
| `Échap` | pause / reprendre |

Sans clavier, le poste de commande en bas de l'écran prend le relais. Trois
modes au choix dans **Réglages** :

- **Manche** — la direction donne le cap, l'amplitude la vitesse.
- **Cap et allure** — on choisit une allure (arrêt, lent, normal, rapide) et on
  corrige le cap par crans de 15° ou d'un demi-tour. Une fois réglé, l'engin
  tient la ligne sans qu'on maintienne quoi que ce soit.
- **Parcours** — on dessine le trajet au doigt sur le champ et l'engin le suit
  point par point.

## L'écran

La page est une colonne : bandeau d'informations en haut, aire de jeu au milieu,
bandeau de commandes en bas. Le rendu 3D ne dessine que dans le rectangle
central, donc rien du HUD ne passe jamais devant la parcelle — seuls les gains
et les confettis traversent. La caméra garde une échelle constante (~13 px par
mètre) quelle que soit la hauteur des bandeaux.

- **En haut** : trésorerie, stock livré, météo et heure, niveau ; le chemin des
  cinq étapes du cycle ; le contrat en cours et sa barre d'avancement.
- **En bas** : le chantier du moment, une jauge qui suit l'avancement réel
  (sol travaillé, semé, fertilisé, maturité, puis remplissage de trémie), les
  boutons de chantier et de réglage, et la manette virtuelle.

## Ce qu'il y a dans la partie

- **Trois cultures.** Le blé est gratuit et rustique ; le colza pousse moins vite
  mais se vend bien mieux ; le maïs est long à mûrir et paie le plus. Chacune a sa
  propre silhouette à l'écran, son prix, son rendement et sa vitesse de pousse.
  Colza et maïs se débloquent en boutique, puis leur semence se paie à chaque semis.
- **Cinq améliorations** (moteur, transmission, trémie, semences, négoce), cinq
  niveaux chacune, payées avec la recette du silo.
- **Des contrats.** Livrer une quantité donnée d'une culture rapporte une prime ;
  un nouveau contrat arrive dès que le précédent est rempli.
- **Une journée qui passe.** Le ciel, la lumière et l'heure évoluent en continu ;
  les phares des engins s'allument à la tombée du jour.
- **La météo.** Dégagé, nuageux ou pluie. La pluie arrose la culture, assombrit
  le ciel, lève le vent dans les épis et ralentit un peu les engins dans la boue.
- **Sauvegarde automatique** dans le navigateur : trésorerie, améliorations,
  cultures débloquées, contrat en cours, jour et étape.
- **Son synthétisé** à la volée (moteur, pluie, encaissements, clics) — aucun fichier audio.
- **Une parcelle qui a du volume.** La terre est un bloc en surépaisseur d'une
  vingtaine de centimètres : les engins y montent pour de vrai et se cabrent sur
  la rampe du bord. Le dessus ondule sur plusieurs échelles, des mottes y sont
  posées, et le bord n'est pas une arête droite mais une découpe crantée.
- **Chaque outil laisse sa trace.** La déchaumeuse projette des mottes de terre
  derrière elle, le semoir sème des grains qui rebondissent au sol, les buses du
  pulvérisateur crachent de vraies gouttes, et la moisson laisse un dépôt de
  paille visible — que le déchaumage suivant enfouit.
- **Des gains qui se voient.** Le grain jaillit de la vis vers la benne pendant le
  transfert ; à l'encaissement, des pièces partent du silo et filent jusqu'au
  compteur, qui rebondit. Fin d'étape, contrat rempli et passage de niveau
  déclenchent confettis et fenêtre de récompense.

## Sous le capot

- `index.html` — le jeu entier : rendu, engins, sol, économie, interface.
- `vendor/three.min.js` — three.js r128, embarqué pour que le jeu tourne hors ligne.
- `sw.js` + `manifest.json` + `icon.svg` — installation en PWA.

Le sol est une grille logique de cellules de 17 cm (`cell`) qui mémorise l'état
travaillé/semé/fertilisé ; ce que l'on voit est un ruban de triangles déposé
derrière chaque outil, à sa largeur exacte. Le blé est en `InstancedMesh`
découpé en 9×9 tuiles pour le frustum culling, avec le vent dans un shader.

`window.__FARM_DEBUG()` renvoie l'état de la partie en lecture seule, pratique
pour vérifier une session sans y jouer.
