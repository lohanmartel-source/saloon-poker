# 🤠 Saloon Poker

Un petit site de **Texas Hold'em** à l'ambiance saloon western. Il fait deux choses :

- **Conseiller** : tu entres tes cartes et celles de la table, et l'app te dit le meilleur move.
- **Jouer vs 3** : une table complète contre 3 adversaires contrôlés par l'ordi.

Tout tourne dans le navigateur. Pas de serveur, pas de compte, pas d'argent réel.

👉 **Jouer en ligne :** `https://lohanmartel-source.github.io/saloon-poker/`

---

## Conseiller

1. Touche tes 2 cartes dans la grille.
2. Ajoute le flop, la turn et la river au fil de la main.
3. Entre le nombre d'adversaires, le pot et la mise à suivre (optionnel).

L'app affiche :

- le move conseillé : **Se coucher**, **Check**, **Suivre**, **Miser** ou **Relancer**, avec une taille de mise ;
- ton **équité** (tes chances de gagner le pot), calculée sur 14 000 mains simulées ;
- la **cote du pot** : l'équité minimale pour qu'un call soit rentable ;
- la force de ta main de départ, ta main actuelle et tes **outs** ;
- tes chances de finir avec chaque combinaison (paire, couleur, full…).

## Jouer vs 3

| Adversaire   | Style                                   |
|--------------|-----------------------------------------|
| Cole Barrett | Agressif : relance souvent              |
| Ma Hollis    | Prudente : joue surtout les bonnes mains |
| Doc Weller   | Bluffeur : mise même avec rien          |

- Départ à 1000 jetons et blindes à 10/20. Les blindes doublent toutes les 10 mains.
- Le conseiller s'affiche à ton tour. Tu peux le désactiver dans les réglages ⚙.
- Les **réglages** permettent de choisir ton nom, tes jetons de départ, la vitesse des adversaires et les sons.
- Le **carnet** garde tes stats (mains gagnées, plus gros pot, meilleure main). Elles sont enregistrées dans ton navigateur.

Lien direct vers la table : `…/saloon-poker/#jouer`

Sur téléphone : ouvre le site, puis choisis **Ajouter à l'écran d'accueil** pour l'avoir comme une app.

---

## Mettre en ligne avec GitHub Pages

1. Crée un dépôt public nommé `saloon-poker` sur GitHub.
2. Envoie les fichiers :
   ```bash
   cd saloon-poker
   git init
   git add .
   git commit -m "Saloon Poker"
   git branch -M main
   git remote add origin https://github.com/lohanmartel-source/saloon-poker.git
   git push -u origin main
   ```
3. Sur GitHub, va dans **Settings → Pages**.
4. Sous **Branch**, choisis `main` et le dossier `/ (root)`, puis clique **Save**.
5. Attends environ 1 minute. Le site est alors à `https://lohanmartel-source.github.io/saloon-poker/`.

## Structure

```
index.html            page principale
css/style.css         thème western
js/engine.js          évaluation des mains, équité, conseils et moteur de partie
js/app.js             interface
tests/engine.test.js  tests du moteur (node tests/engine.test.js)
manifest.webmanifest  installation sur téléphone
icon.svg              icône
```

## Licence

MIT. Projet de fan sans lien avec un éditeur de jeux vidéo.

