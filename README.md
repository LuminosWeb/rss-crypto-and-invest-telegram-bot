# 🚀 RSS Crypto & Invest Telegram Bot

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-lightgrey)
![PM2](https://img.shields.io/badge/PM2-Ready-red)
![GitHub last commit](https://img.shields.io/github/last-commit/LuminosWeb/rss-crypto-and-invest-telegram-bot)

Bot Telegram permettant de publier automatiquement les dernières actualités **Crypto** et **Investissement** à partir de plusieurs flux RSS.

Le bot vérifie régulièrement les flux configurés, détecte les nouveaux articles puis les publie automatiquement dans un canal Telegram.

---

# 📦 Dépôt GitHub

https://github.com/LuminosWeb/rss-crypto-and-invest-telegram-bot

---

# ✨ Fonctionnalités

- 📡 Lecture de plusieurs flux RSS simultanément
- 🚀 Publication automatique sur Telegram
- 📰 Formatage propre des articles
- 🔗 Lien direct vers la source
- 🧹 Nettoyage automatique du HTML
- ✅ Évite les doublons
- 💾 Sauvegarde des articles déjà publiés
- ⏱ Vérification automatique toutes les 5 minutes
- 🛡 Gestion des erreurs réseau
- 🔁 Compatible PM2
- ⚡ Fonctionne 24h/24

---

# Prérequis

- Node.js 18 ou supérieur
- npm
- Un bot Telegram
- Un canal Telegram
- PM2 (optionnel mais recommandé)

---

# Installation

Cloner le dépôt :

```bash
git clone https://github.com/LuminosWeb/rss-crypto-and-invest-telegram-bot.git

cd rss-crypto-and-invest-telegram-bot
```

Installer les dépendances :

```bash
npm install
```

---

# Création du bot Telegram

Créer un bot via :

```
@BotFather
```

Récupérer le Token API fourni.

Ajouter ensuite votre bot comme **Administrateur** du canal Telegram.

---

# Configuration

Le bot utilise des variables d'environnement.

Sous Linux :

```bash
export TELEGRAM_BOT_TOKEN="VOTRE_TOKEN"
export TELEGRAM_CHANNEL_ID="@NomDuCanal"
```

Ou :

```bash
export TELEGRAM_CHANNEL_ID="-1001234567890"
```

Sous Windows :

```cmd
set TELEGRAM_BOT_TOKEN=VOTRE_TOKEN

set TELEGRAM_CHANNEL_ID=@NomDuCanal
```

---

# Configuration des flux RSS

Dans le fichier :

```
telegram_news_bot.js
```

Modifier le tableau :

```javascript
const RSS_FEEDS = [
    "https://site1.com/rss",
    "https://site2.com/feed",
    "https://site3.com/rss"
];
```

Vous pouvez ajouter autant de flux que vous souhaitez.

---

# Lancement

```bash
node telegram_news_bot.js
```

ou

```bash
npm start
```

---

# Premier démarrage

Lors du premier lancement, le bot :

- récupère les articles déjà présents dans les flux
- les enregistre comme déjà vus
- ne publie rien

Seules les nouvelles publications seront envoyées ensuite.

---

# Déploiement avec PM2

Installer PM2 :

```bash
npm install -g pm2
```

Lancer le bot :

```bash
pm2 start telegram_news_bot.js --name rss-crypto
```

Vérifier son état :

```bash
pm2 status
```

Afficher les logs :

```bash
pm2 logs rss-crypto
```

Redémarrer :

```bash
pm2 restart rss-crypto
```

Arrêter :

```bash
pm2 stop rss-crypto
```

Supprimer :

```bash
pm2 delete rss-crypto
```

---

# Démarrage automatique au boot

Configurer PM2 :

```bash
pm2 startup
```

Puis sauvegarder :

```bash
pm2 save
```

Le bot redémarrera automatiquement après un redémarrage du serveur.

---

# Arborescence

```
.
├── telegram_news_bot.js
├── package.json
├── package-lock.json
├── seen_articles.json
└── README.md
```

---

# Fonctionnement

Toutes les **5 minutes**, le bot :

1. télécharge les flux RSS
2. recherche les nouveaux articles
3. nettoie le contenu HTML
4. construit un message Telegram
5. publie dans le canal
6. enregistre l'article comme déjà envoyé

Les doublons sont automatiquement ignorés.

---

# Variables utilisées

| Variable | Description |
|-----------|-------------|
| TELEGRAM_BOT_TOKEN | Token du bot Telegram |
| TELEGRAM_CHANNEL_ID | Identifiant ou @NomDuCanal |

---

# Sécurité

Ne jamais écrire le Token directement dans le code.

Toujours utiliser des variables d'environnement.

Si votre Token est divulgué :

1. ouvrir BotFather
2. utiliser :

```
/revoke
```

3. générer un nouveau Token.

---

# Licence

MIT

---

Développé avec ❤️ pour automatiser la veille Crypto & Investissement.
