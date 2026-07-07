/**
 * Bot Telegram - Publication automatique de news depuis des flux RSS
 * ====================================================================
 *
 * INSTALLATION
 * ------------
 * npm install
 *
 * CONFIGURATION
 * -------------
 * 1. Crée ton bot avec @BotFather sur Telegram -> récupère le TOKEN
 * 2. Ajoute ton bot comme ADMINISTRATEUR de ton canal
 * 3. Récupère l'ID de ton canal (ex: @moncanal ou -1001234567890)
 * 4. Trouve les flux RSS de tes sites (souvent : monsite.com/feed ou /rss)
 *    -> Astuce : cherche "site:monsite.com rss" sur Google, ou regarde
 *    dans le code source de la page une balise <link type="application/rss+xml">
 * 5. Définis le token via une variable d'environnement (ne le mets jamais
 *    en clair dans le code) :
 *      export TELEGRAM_BOT_TOKEN="xxxx:yyyy"      (Linux/Mac)
 *      set TELEGRAM_BOT_TOKEN=xxxx:yyyy           (Windows cmd)
 *
 * Remplis les variables ci-dessous puis lance : node telegram_news_bot.js
 * (ou : npm start)
 */


require("dotenv").config();
const Parser = require("rss-parser");
const fs = require("fs");
const path = require("path");

// ============ CONFIGURATION À MODIFIER ============

// SÉCURITÉ : le token ne doit JAMAIS être écrit en dur dans le code.
// Il doit obligatoirement venir de la variable d'environnement TELEGRAM_BOT_TOKEN.
// Si un token s'est déjà retrouvé en clair dans ce fichier par le passé,
// régénère-le immédiatement via @BotFather (commande /revoke), car il faut
// le considérer comme compromis.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "TON @ CHANNEL"; // Ou l'ID numérique du canal (-100...)

if (!BOT_TOKEN) {
  console.error(
    "[ERROR] La variable d'environnement TELEGRAM_BOT_TOKEN n'est pas définie.\n" +
    "        Définis-la avant de lancer le bot, par exemple :\n" +
    '        export TELEGRAM_BOT_TOKEN="xxxx:yyyy"   (Linux/Mac)\n' +
    "        set TELEGRAM_BOT_TOKEN=xxxx:yyyy        (Windows cmd)"
  );
  process.exit(1);
}

const RSS_FEEDS = [
  "LIEN POUR RECUP LES DONNEES",
  "LIEN POUR RECUP LES DONNEES",
  "LIEN POUR RECUP LES DONNEES",
  "LIEN POUR RECUP LES DONNEES",
  "LIEN POUR RECUP LES DONNEES",
  "LIEN POUR RECUP LES DONNEES",
];

const CHECK_INTERVAL = 5 * 60 * 1000; // Intervalle de vérification en ms (5 min).
// NOTE : la valeur précédente (50 secondes) était bien trop agressive pour
// interroger 6 flux RSS en continu : risque de blocage/429 par les sites
// sources ET de "flood control" côté Telegram. 5 minutes est un minimum
// raisonnable ; ne descends pas sous 1 minute.
const SEEN_FILE = path.join(__dirname, "seen_articles.json"); // Fichier local de suivi des articles déjà postés
const SEEN_FILE_TMP = `${SEEN_FILE}.tmp`;
const MAX_SEEN_ARTICLES = 3000; // Empêche seen_articles.json de grossir indéfiniment
const DELAI_ENTRE_PUBLICATIONS = 120 * 1000; // Délai en ms entre chaque envoi (2 min)
const TIMEOUT_FLUX_MS = 20 * 1000; // Timeout par flux RSS pour éviter un blocage indéfini

// ===================================================

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const parser = new Parser({
  timeout: TIMEOUT_FLUX_MS,
  headers: {
    // Certains sites (ex: investing.com, cryptonews.com) bloquent ou limitent
    // les requêtes sans User-Agent "de navigateur".
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["description", "description"],
      ["content:encoded", "contentEncoded"],
      ["summary", "summary"],
    ],
  },
});

function log(niveau, message) {
  const horodatage = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`${horodatage} [${niveau}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chargerArticlesVus() {
  if (fs.existsSync(SEEN_FILE)) {
    try {
      const contenu = fs.readFileSync(SEEN_FILE, "utf-8");
      const donnees = JSON.parse(contenu);
      if (Array.isArray(donnees)) {
        return new Set(donnees);
      }
      log("WARN", "seen_articles.json a un format inattendu, réinitialisation.");
    } catch (e) {
      // Fichier corrompu (ex: crash pendant une écriture précédente) :
      // on ne plante pas le bot, on repart d'un état vide plutôt que de crasher.
      log("ERROR", `seen_articles.json illisible/corrompu (${e.message}), réinitialisation.`);
      try {
        fs.copyFileSync(SEEN_FILE, `${SEEN_FILE}.corrompu-${Date.now()}.bak`);
      } catch (_) {
        // pas grave si la sauvegarde du fichier corrompu échoue
      }
    }
  }
  return new Set();
}

function sauvegarderArticlesVus(seen) {
  try {
    let liste = [...seen];
    // On borne la taille pour éviter que le fichier grossisse indéfiniment
    // au fil des mois/années. On garde les plus récents (ajoutés en dernier).
    if (liste.length > MAX_SEEN_ARTICLES) {
      liste = liste.slice(liste.length - MAX_SEEN_ARTICLES);
      // On resynchronise le Set en mémoire avec la liste bornée
      seen.clear();
      for (const id of liste) seen.add(id);
    }
    // Écriture atomique : on écrit dans un fichier temporaire puis on renomme,
    // pour ne jamais laisser seen_articles.json dans un état à moitié écrit
    // si le processus plante pendant l'écriture.
    fs.writeFileSync(SEEN_FILE_TMP, JSON.stringify(liste), "utf-8");
    fs.renameSync(SEEN_FILE_TMP, SEEN_FILE);
  } catch (e) {
    log("ERROR", `Impossible d'écrire seen_articles.json: ${e.message}`);
  }
}

// Retourne un statut détaillé plutôt qu'un simple booléen, pour que l'appelant
// puisse distinguer :
// - succès
// - erreur temporaire (réseau, 429 flood, 5xx serveur Telegram) -> on réessaiera au prochain cycle
// - erreur permanente (400 message invalide, 403 bot exclu du canal...) -> inutile de réessayer indéfiniment
async function envoyerMessage(texte) {
  const url = `${TELEGRAM_API}/sendMessage`;
  try {
    const params = new URLSearchParams({
      chat_id: CHANNEL_ID,
      text: texte,
      parse_mode: "HTML",
      disable_web_page_preview: "false",
    });

    const reponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (reponse.ok) {
      return { ok: true, permanent: false };
    }

    let corps = {};
    const texteErreur = await reponse.text();
    try {
      corps = JSON.parse(texteErreur);
    } catch (_) {
      // réponse non-JSON, on garde le texte brut pour le log
    }

    log("ERROR", `Erreur envoi Telegram: ${reponse.status} - ${texteErreur}`);

    if (reponse.status === 429) {
      // Flood control Telegram : il faut attendre "retry_after" secondes.
      const retryAfter = (corps.parameters && corps.parameters.retry_after) || 30;
      log("WARN", `Limite de débit Telegram atteinte, pause de ${retryAfter}s.`);
      await sleep(retryAfter * 1000);
      return { ok: false, permanent: false };
    }

    if (reponse.status >= 500) {
      // Erreur côté serveur Telegram : temporaire, on réessaiera plus tard.
      return { ok: false, permanent: false };
    }

    // 400 (message/HTML invalide, texte trop long...), 403 (bot pas admin /
    // retiré du canal), 404 (chat_id invalide) : ce sont des erreurs
    // permanentes pour CET article précis. Réessayer indéfiniment ne ferait
    // que spammer les logs à chaque cycle sans jamais réussir.
    return { ok: false, permanent: true };
  } catch (e) {
    log("ERROR", `Exception lors de l'envoi Telegram: ${e.message}`);
    return { ok: false, permanent: false };
  }
}

// Décode les entités HTML (ex: &#039; -> ', &rsquo; -> ’, &amp; -> &, etc.)
// C'est ce qui manquait : sans ça, les apostrophes et caractères accentués
// encodés dans les flux RSS restaient sous forme de code brut (&#039;, =E2=80=99...)
function decoderEntitesHtml(texte) {
  if (!texte) return "";

  const entitesNommees = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&rsquo;": "’",
    "&lsquo;": "‘",
    "&rdquo;": "”",
    "&ldquo;": "“",
    "&hellip;": "…",
    "&mdash;": "—",
    "&ndash;": "–",
    "&eacute;": "é",
    "&egrave;": "è",
    "&agrave;": "à",
    "&ccedil;": "ç",
    "&ecirc;": "ê",
    "&ocirc;": "ô",
    "&ugrave;": "ù",
    "&icirc;": "î",
    "&euro;": "€",
    "&laquo;": "«",
    "&raquo;": "»",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&deg;": "°",
    "&plusmn;": "±",
    "&times;": "×",
    "&divide;": "÷",
    "&sect;": "§",
    "&para;": "¶",
    "&middot;": "·",
    "&bull;": "•",
    "&dagger;": "†",
    "&permil;": "‰",
    "&iexcl;": "¡",
    "&iquest;": "¿",
    "&szlig;": "ß",
    "&ntilde;": "ñ",
    "&auml;": "ä",
    "&ouml;": "ö",
    "&uuml;": "ü",
    "&aring;": "å",
    "&oslash;": "ø",
    "&aelig;": "æ",
    "&oelig;": "œ",
    "&scaron;": "š",
    "&uacute;": "ú",
    "&iacute;": "í",
    "&oacute;": "ó",
    "&aacute;": "á",
  };

  return texte
    // entités numériques hexadécimales : &#x2019;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // entités numériques décimales : &#8217;
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // entités nommées : &rsquo; &amp; &#039; etc.
    .replace(/&[a-zA-Z]+;/g, (match) => entitesNommees[match] || match);
}

function nettoyerTexte(texte) {
  if (!texte) return "";
  return decoderEntitesHtml(
    texte
      .replace(/<[^>]*>/g, "") // enlève les balises HTML
      .replace(/\s+/g, " ")    // normalise les espaces/retours à la ligne
      .trim()
  );
}

function tronquer(texte, longueurMax) {
  if (texte.length <= longueurMax) return texte;
  const coupe = texte.slice(0, longueurMax);
  const dernierEspace = coupe.lastIndexOf(" ");
  const texteFinal = dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe;
  return texteFinal.trim() + "…";
}

// Une fois les entités décodées (&amp; -> &, &lt; -> < ...), il faut ré-échapper
// &, < et > avant d'envoyer en parse_mode HTML à Telegram, sinon un caractère
// comme "<" ou "&" isolé dans le texte casse le parsing HTML de Telegram.
// On échappe donc le contenu variable, mais pas les balises <b>/<a> qu'on
// ajoute nous-mêmes dans le template.
function echapperHtmlTelegram(texte) {
  if (!texte) return "";
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const LIMITE_TELEGRAM = 4096; // Limite stricte de l'API Telegram pour sendMessage

function formaterMessage(entry, nomSource) {
  // nettoyerTexte (et non juste decoderEntitesHtml) pour aussi retirer
  // d'éventuelles balises HTML présentes dans un titre mal formé.
  const titreBrut = nettoyerTexte(entry.title) || "Sans titre";
  const titre = tronquer(titreBrut, 300); // évite un titre démesuré qui ferait dépasser la limite Telegram
  const lien = entry.link || "";

  // On récupère TOUS les champs possibles, puis on garde le plus complet
  // (chaque flux RSS remplit des champs différents avec plus ou moins de détails)
  const candidats = [
    entry.contentEncoded,
    entry.content,
    entry.description,
    entry.contentSnippet,
    entry.summary,
  ]
    .filter(Boolean)
    .map((texte) => nettoyerTexte(texte));

  // On choisit le texte le plus long (donc le plus détaillé)
  const descriptionBrute = candidats.sort((a, b) => b.length - a.length)[0] || "";
  const description = tronquer(descriptionBrute, 800);

  if (!description) {
    log("WARN", `Aucune description trouvée pour "${titre}" (source: ${nomSource}). Champs disponibles: ${Object.keys(entry).join(", ")}`);
  }

  const titreEchappe = echapperHtmlTelegram(titre);
  let descriptionEchappee = echapperHtmlTelegram(description);
  const nomSourceEchappe = echapperHtmlTelegram(nomSource);
  // Le lien va dans un attribut href="..." : on échappe aussi & et " pour
  // ne jamais casser l'attribut HTML (ex: URL avec "?a=1&b=2").
  const lienEchappe = (lien || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const pied = `\n\n🔗 <a href="${lienEchappe}">Lire l'article</a>\n\n<i>Source : ${nomSourceEchappe}</i>`;
  const entete = `📰 <b>${titreEchappe}</b>`;

  // Garde-fou final : quoi qu'il arrive, on ne dépasse jamais la limite
  // Telegram (4096 caractères), sinon l'envoi échouerait systématiquement
  // et l'article resterait bloqué en boucle à chaque cycle.
  const margeDisponible = LIMITE_TELEGRAM - entete.length - pied.length - 10;
  if (descriptionEchappee && margeDisponible > 0 && descriptionEchappee.length > margeDisponible) {
    descriptionEchappee = tronquer(descriptionEchappee, margeDisponible);
  } else if (margeDisponible <= 0) {
    descriptionEchappee = "";
  }

  let message = entete;
  if (descriptionEchappee) {
    message += `\n\n${descriptionEchappee}`;
  }
  message += pied;

  return message;
}

async function verifierFlux(seen) {
  const nouveauxArticles = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const flux = await parser.parseURL(feedUrl);
      const nomSource = flux.title || feedUrl;

      for (const entry of flux.items) {
        const articleId = entry.guid || entry.id || entry.link;
        if (articleId && !seen.has(articleId)) {
          nouveauxArticles.push([articleId, entry, nomSource]);
        }
      }
    } catch (e) {
      log("ERROR", `Erreur lecture flux ${feedUrl}: ${e.message}`);
    }
  }

  return nouveauxArticles;
}

async function main() {
  const seen = chargerArticlesVus();
  const premierLancement = seen.size === 0;

  log("INFO", "Démarrage du bot de news...");

  if (premierLancement) {
    // Au tout premier lancement, on marque tous les articles déjà publiés
    // sur les sites comme "vus" SANS les envoyer. Seules les prochaines
    // news (publiées après le lancement du bot) seront envoyées sur Telegram.
    log("INFO", "Premier lancement : indexation des articles existants (aucun envoi)...");
    const articlesExistants = await verifierFlux(seen);
    for (const [articleId] of articlesExistants) {
      seen.add(articleId);
    }
    sauvegarderArticlesVus(seen);
    log("INFO", `${articlesExistants.length} articles existants indexés. Le bot est prêt.`);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const nouveaux = await verifierFlux(seen);

      if (nouveaux.length > 0) {
        for (const [articleId, entry, nomSource] of nouveaux) {
          try {
            const message = formaterMessage(entry, nomSource);
            const resultat = await envoyerMessage(message);

            if (resultat.ok) {
              log("INFO", `Publié : ${entry.title}`);
              seen.add(articleId);
              sauvegarderArticlesVus(seen);
              await sleep(DELAI_ENTRE_PUBLICATIONS); // délai entre 2 publications
            } else if (resultat.permanent) {
              // Erreur définitive (message invalide, bot exclu du canal...) :
              // on marque quand même l'article comme vu pour ne pas rester
              // bloqué à réessayer le même envoi voué à l'échec à chaque cycle.
              log("WARN", `Échec définitif pour "${entry.title}", article ignoré désormais.`);
              seen.add(articleId);
              sauvegarderArticlesVus(seen);
            } else {
              // Erreur temporaire (réseau, flood control, 5xx) : on ne marque
              // PAS l'article comme vu, il sera retenté au prochain cycle.
              log("WARN", `Échec temporaire pour "${entry.title}", nouvel essai au prochain cycle.`);
            }
          } catch (e) {
            // Une erreur inattendue sur UN article ne doit jamais arrêter le bot.
            log("ERROR", `Erreur inattendue lors du traitement d'un article: ${e.message}`);
          }
        }
      } else {
        log("INFO", "Aucun nouvel article.");
      }
    } catch (e) {
      // Filet de sécurité global pour ce cycle : on log et on continue à la
      // prochaine itération plutôt que de laisser le process planter.
      log("ERROR", `Erreur inattendue dans la boucle principale: ${e.message}`);
    }

    await sleep(CHECK_INTERVAL);
  }
}

main().catch((e) => {
  log("ERROR", `Erreur fatale: ${e.message}`);
  process.exit(1);
});
