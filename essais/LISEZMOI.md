# Essais

Banc d'essai du jeu : on sert le dossier parent en local, on ouvre la page dans
Chromium, et on interroge la sonde `window.__FARM_DEBUG()` du jeu.

    npm install playwright        # une fois
    node essais/err.js            # la page se charge-t-elle sans erreur ?
    node essais/chrono.js         # temps de chargement, fichier par fichier
    node essais/geste.js          # les seuils du tracé au doigt
    node essais/trajet.js         # fidélité au dessin, puis `node essais/plot.js`
    node essais/etats.js          # captures des états du sol
    node essais/smoke.js          # démarrage complet, relevé de toutes les valeurs
    node essais/parc.js           # niveaux de tracteur, bennes, décrochage, sauvegarde
    node essais/engins.js         # planches des trois attelages et des trois bennes

Les images sortent dans `essais/sorties/`.

`trajet.js` enregistre le dessin et la position de l'engin image par image dans
`sorties/trajet.json` ; `plot.js` superpose les deux. C'est ce relevé qui sert à
juger le suivi de parcours — une moyenne ne montre pas qu'un tracteur tourne en
rond.

Attention au temps : la machine d'essai n'a pas de carte graphique, le rendu
tourne à une image et demie par seconde. Une seconde de jeu simulée coûte donc
une dizaine de secondes réelles. Les essais qui font rouler un engin durent des
minutes ; ceux qui partent d'une sauvegarde préparée sont bien plus rapides.
