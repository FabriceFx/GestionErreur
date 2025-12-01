# LogLib - Bibliothèque de Gestion d'Erreurs Enterprise

![License MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Google%20Apps%20Script-green)
![Runtime](https://img.shields.io/badge/Google%20Apps%20Script-V8-green)
![Author](https://img.shields.io/badge/Auteur-Fabrice%20Faucheux-orange)

Une solution robuste pour centraliser les logs d'erreurs Google Apps Script dans un Google Sheet, avec rotation automatique des logs et alertes email HTML enrichies pour les erreurs critiques.

## 🚀 Fonctionnalités Clés

* **Centralisation** : Tous les logs sont écrits dans un Spreadsheet unique.
* **Rotation Automatique** : Supprime les anciennes lignes pour éviter de saturer le Sheet (limite par défaut : 2000 lignes).
* **Alertes HTML** : Envoie des emails formatés proprement avec contexte JSON et Stack Trace.
* **Concurrence** : Utilise `LockService` pour éviter les conflits d'écriture.
* **Contexte Enrichi** : Permet de passer des objets JSON (ex: ID client, données traitées) pour faciliter le débogage.

## 🛠 Installation

1.  Créez un nouveau script ou un fichier `LogLib.gs` dans votre projet.
2.  Copiez le code fourni dans ce fichier.
3.  Créez un Google Sheet vierge qui servira de réceptacle aux logs. Notez son ID (disponible dans l'URL).

## 💻 Utilisation

### 1. Initialisation
Au tout début de votre script principal (ou dans la zone globale), initialisez la bibliothèque.

```javascript
const CONFIG_LOGS = {
  idSpreadsheet: "1abc...votre_id_spreadsheet...xyz", // OBLIGATOIRE
  emailsAlerte: "admin@domaine.com,dev@domaine.com",  // Recommandé
  nomFeuille: "Logs_Production"                       // Optionnel (défaut: 'Erreurs')
};

// Si utilisé comme bibliothèque externe : LogLib.init(CONFIG_LOGS);
// Si code inclus directement :
init(CONFIG_LOGS);
