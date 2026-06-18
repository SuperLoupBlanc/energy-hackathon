# AstraFlux - Energy Hackathon

[Demo web jouable](https://superloupblanc.github.io/energy-hackathon/)

Prototype web jouable pour GitHub Pages.

## Concept

Mini-jeu Three.js plein ecran. Le joueur controle Nyra, prospectrice science-fiction, qui extrait une energie futuriste depuis un champ magnetique instable.

Le lore melange une base scientifique reelle et une extrapolation fictive :

- effet magnetocalorique : certains materiaux changent de temperature quand un champ magnetique varie ;
- effet barocalorique : certains solides changent de temperature ou d'entropie sous pression ;
- refroidissement solide : alternative aux cycles de compression classiques ;
- stockage inverse fictif : noyau froid silicium-verre ordonne en cellules hexagonales ;
- gameplay : le rendement augmente avec la pression locale, mais l'equilibre entre energie positive et energie inverse doit rester proche de zero.

## Stack

- HTML
- CSS
- JavaScript
- Three.js
- Chart.js
- TensorFlow.js
- Compatible GitHub Pages

## Lancer en local

```bash
python -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000
```

## Deploiement

Activer GitHub Pages :

```text
Settings > Pages > Deploy from a branch > main > /root
```
