/**
 * @fileoverview Bibliothèque de gestion d'erreurs "Enterprise" (Log + Email HTML + Rotation + Contexte).
 * Permet de centraliser les logs dans un Spreadsheet et d'alerter les admins par email.
 * @author Fabrice Faucheux
 * @version 4.1 (Ajout fonction de test et validation)
 */

// --- ÉTAT INTERNE (Configuration par défaut) ---
let _config = {
  idSpreadsheet: null,          // ID du Sheet (Obligatoire)
  nomFeuille: 'Erreurs',        // Nom de l'onglet
  emailsAlerte: '',             // Emails des admins (séparés par virgules)
  motsClesCritiques: ['FATAL', 'CRITIQUE', 'URGENT', 'API_DOWN'],
  maxLignesLogs: 2000           // Rotation automatique après 2000 lignes
};

/**
 * Initialise la bibliothèque pour le script client en cours.
 * Cette méthode DOIT être appelée au début de vos scripts (ex: dans une variable globale ou au début du main).
 *
 * @param {Object} config - L'objet de configuration.
 * @param {string} config.idSpreadsheet - L'ID du Google Sheet de logs.
 * @param {string} [config.nomFeuille='Erreurs'] - Le nom de l'onglet (défaut: 'Erreurs').
 * @param {string} [config.emailsAlerte=''] - Liste des emails séparés par des virgules.
 * @param {number} [config.maxLignesLogs=2000] - Nombre max de lignes avant rotation.
 */
function init(config) {
  if (!config || !config.idSpreadsheet) {
    throw new Error("LogLib : L'ID du Spreadsheet est obligatoire dans init().");
  }
  // Fusion de la config par défaut avec la config utilisateur (Spread syntax)
  _config = { ..._config, ...config };
}

/**
 * Enregistre une erreur, gère la rotation des logs et envoie une alerte HTML enrichie si nécessaire.
 *
 * @param {string} nomScript - Nom du projet client ou du module.
 * @param {string} nomFonction - Nom de la fonction où l'erreur a eu lieu.
 * @param {Error|string} erreur - L'objet Error capturé ou un message string.
 * @param {Object|null} [contexte=null] - (Optionnel) Données contextuelles (ex: {idClient: 12, etape: 'validation'}).
 * @param {boolean} [forcerAlerte=false] - (Optionnel) Si true, envoie un email même sans mot-clé critique.
 */
function journaliserErreur(nomScript, nomFonction, erreur, contexte = null, forcerAlerte = false) {
  
  // Sécurité : Vérification de l'initialisation
  if (!_config.idSpreadsheet) {
    console.error("❌ ERREUR FATALE LogLib : Bibliothèque non initialisée ! Appelez init() avec un ID Spreadsheet.");
    console.error(erreur);
    return;
  }

  const horodatage = new Date();
  const utilisateur = Session.getEffectiveUser().getEmail();
  
  // Normalisation de l'erreur (si on passe une string au lieu d'un objet Error)
  const estObjetErreur = erreur instanceof Error;
  const messageErreur = estObjetErreur ? erreur.message : String(erreur);
  const pileExecution = estObjetErreur ? (erreur.stack || "Non disponible") : "Trace non disponible (Message simple)";
  
  // Conversion du contexte en chaîne JSON pour le stockage lisible
  const contexteString = contexte ? JSON.stringify(contexte, null, 2) : "";

  // Log console natif (GCP Logs)
  console.error(`[${nomScript} | ${nomFonction}] ${messageErreur}`);

  // --- 1. ÉCRITURE SHEET + ROTATION ---
  try {
    // Utilisation d'un verrou pour éviter les conflits d'écriture concurrents
    const verrou = LockService.getScriptLock();
    
    // Tentative d'obtention du verrou pendant 5 secondes
    if (verrou.tryLock(5000)) {
      const classeurLog = SpreadsheetApp.openById(_config.idSpreadsheet);
      let feuilleLog = classeurLog.getSheetByName(_config.nomFeuille);

      // Création de la feuille si elle n'existe pas (Bootstrapping)
      if (!feuilleLog) {
        feuilleLog = classeurLog.insertSheet(_config.nomFeuille);
        feuilleLog.appendRow(['Date', 'Utilisateur', 'Script', 'Fonction', 'Message', 'Stack Trace', 'Contexte']);
        // Formatage de l'en-tête
        feuilleLog.getRange(1, 1, 1, 7)
          .setFontWeight('bold')
          .setBackground('#ffebee') // Rouge très pâle
          .setBorder(true, true, true, true, true, true);
        feuilleLog.setFrozenRows(1);
      }

      // Ajout du log
      feuilleLog.appendRow([horodatage, utilisateur, nomScript, nomFonction, messageErreur, pileExecution, contexteString]);

      // --- LOG ROTATION (Nettoyage automatique) ---
      // Optimisation : On ne vérifie la rotation que si on écrit
      const totalLignes = feuilleLog.getLastRow();
      const seuil = _config.maxLignesLogs;
      
      // Si on dépasse le seuil + tampon de 50 lignes (pour éviter de supprimer à chaque ligne)
      if (totalLignes > seuil + 50) {
        const aSupprimer = totalLignes - seuil;
        // Suppression par lot (batch operation) pour la performance
        feuilleLog.deleteRows(2, aSupprimer);
        console.log(`🧹 LogLib : Rotation effectuée. ${aSupprimer} anciennes lignes supprimées.`);
      }
      
      verrou.releaseLock();
    } else {
      console.warn("LogLib : Impossible d'obtenir le verrou pour écrire dans le Spreadsheet.");
    }
  } catch (e) {
    // Fallback ultime : si le logging échoue, on ne veut pas casser le script principal
    console.error(`LogLib System Error (Sheet Write) : ${e.message}`);
  }

  // --- 2. ALERTE EMAIL HTML ---
  try {
    const contientMotCle = _config.motsClesCritiques.some(mot => messageErreur.toUpperCase().includes(mot));
    
    // Envoi si : (Critique OU Forcé) ET (Emails configurés)
    if ((forcerAlerte || contientMotCle) && _config.emailsAlerte) {
      envoyerEmailAlerte(nomScript, nomFonction, utilisateur, horodatage, messageErreur, pileExecution, contexteString, contexte);
    }
  } catch (e) {
    console.error(`LogLib System Error (Email Send) : ${e.message}`);
  }
}

/**
 * Fonction interne pour construire et envoyer l'email HTML.
 * (Séparée pour la lisibilité).
 */
function envoyerEmailAlerte(script, fonction, user, date, msg, stack, ctxString, ctxObj) {
  const sujet = `[ALERTE] ${script} : ${fonction}`;
  const corpsTexte = `Erreur critique détectée.\nScript: ${script}\nFonction: ${fonction}\nErreur: ${msg}\n\nVoir la version HTML pour les détails.`;

  // Construction du bloc HTML pour le contexte
  let htmlContexte = '';
  if (ctxObj) {
    htmlContexte = `
      <div style="background-color: #e3f2fd; padding: 10px; margin: 15px 0; border-left: 5px solid #2196f3; font-family: monospace; font-size: 11px; overflow-x: auto;">
        <strong style="color: #1565c0;">&#128230; Données de contexte :</strong><br>
        <pre style="margin: 5px 0 0 0;">${ctxString}</pre>
      </div>
    `;
  }

  const corpsHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 650px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #d32f2f; color: white; padding: 15px;">
        <h2 style="margin: 0; font-size: 18px;">&#128680; Alerte : Erreur Critique Détectée</h2>
      </div>
      
      <div style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 5px; width: 100px; color: #757575;"><strong>Script :</strong></td>
            <td style="padding: 5px;">${script}</td>
          </tr>
          <tr>
            <td style="padding: 5px; color: #757575;"><strong>Fonction :</strong></td>
            <td style="padding: 5px;">${fonction}</td>
          </tr>
          <tr>
            <td style="padding: 5px; color: #757575;"><strong>Utilisateur :</strong></td>
            <td style="padding: 5px;">${user}</td>
          </tr>
          <tr>
            <td style="padding: 5px; color: #757575;"><strong>Date :</strong></td>
            <td style="padding: 5px;">${date.toLocaleString('fr-FR')}</td>
          </tr>
        </table>

        <div style="background-color: #ffebee; border-left: 5px solid #d32f2f; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
          <strong style="color: #c62828;">Message d'erreur :</strong><br>
          <span style="font-size: 14px; display: block; margin-top: 5px;">${msg}</span>
        </div>

        ${htmlContexte}

        <div style="margin-top: 20px;">
          <strong style="color: #555;">&#128220; Stack Trace :</strong>
          <div style="background-color: #f5f5f5; padding: 10px; margin-top: 5px; font-family: monospace; font-size: 11px; white-space: pre-wrap; border: 1px solid #eee; border-radius: 4px; max-height: 200px; overflow-y: auto;">
            ${stack}
          </div>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="https://docs.google.com/spreadsheets/d/${_config.idSpreadsheet}" style="background-color: #1976d2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px;">
            Accéder aux Logs
          </a>
        </div>
      </div>
      <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee;">
        Généré automatiquement par LogLib v4.1
      </div>
    </div>
  `;

  GmailApp.sendEmail(_config.emailsAlerte, sujet, corpsTexte, {
    htmlBody: corpsHtml,
    name: "Automate Apps Script" // Nom de l'expéditeur
  });
}

/**
 * Fonction utilitaire pour tester la configuration lors de l'installation.
 * Lance une erreur de test.
 */
function testerConfiguration() {
  // Configurer avec l'ID réel ici pour le test uniquement si pas encore fait via init() ailleurs
  // init({ idSpreadsheet: "VOTRE_ID_ICI", emailsAlerte: "votre@email.com" }); 
  
  try {
    throw new Error("Ceci est une erreur de TEST pour valider LogLib.");
  } catch (e) {
    journaliserErreur("TestInstallation", "testerConfiguration", e, { test: "OK", statut: "En cours" }, true);
  }
}
