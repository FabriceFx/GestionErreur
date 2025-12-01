# GAS-LogLib : Gestionnaire d'Erreurs & Monitoring pour Google Apps Script

![Version](https://img.shields.io/badge/version-4.1.0-blue.svg)
![License MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Google%20Apps%20Script-green)
![Runtime](https://img.shields.io/badge/Runtime-V8-orange)
![Author](https://img.shields.io/badge/Auteur-Fabrice%20Faucheux-lightgrey)

**GAS-LogLib** est une solution robuste, légère et autonome permettant de gérer les erreurs (Error Handling), de centraliser les logs et d'alerter les administrateurs au sein de l'écosystème Google Workspace.

Conçue pour les environnements de production critiques, elle gère la **concurrence d'accès**, la **rotation automatique des logs** (pour ne pas saturer vos Spreadsheets) et l'envoi d'**alertes email HTML enrichies**.

---

## 📋 Table des Matières

1. [Fonctionnalités Clés](#-fonctionnalités-clés)
2. [Prérequis](#-prérequis)
3. [Installation](#-installation)
4. [Configuration](#-configuration)
5. [Utilisation](#-utilisation)
    - [Cas Standard (Try/Catch)](#cas-standard-trycatch)
    - [Utilisation du Contexte](#utilisation-du-contexte)
    - [Forcer une Alerte](#forcer-une-alerte)
6. [Architecture & Performance](#-architecture--performance)
7. [Référence API](#-référence-api)
8. [Contribuer](#-contribuer)

---

## 🚀 Fonctionnalités Clés

* **🛡️ Robustesse Maximale** : Utilisation de `LockService` pour garantir l'intégrité des logs même lors d'exécutions simultanées.
* **🧹 Rotation Intelligente** : Maintien automatique de la taille du fichier de log (FIFO - First In, First Out) selon un seuil configurable (défaut : 2000 lignes).
* **📧 Alertes Contextuelles** : Emails HTML responsive incluant la pile d'exécution (Stack Trace), les données contextuelles JSON et les métadonnées de l'exécution.
* **⚙️ Zéro Dépendance** : Fonctionne nativement sans bibliothèque tierce.
* **🔍 Traçabilité** : Enregistre l'utilisateur effectif, le nom du script, la fonction et l'horodatage précis.

---

## 📦 Prérequis

* Un compte **Google Workspace** ou Gmail.
* Un projet **Google Apps Script** (autonome ou lié à un document).
* Un **Google Sheet** vierge qui servira de base de données de logs.

---

## 🛠 Installation

### Méthode 1 : Copier-Coller (Recommandée pour petits projets)
1.  Ouvrez votre projet Apps Script.
2.  Créez un nouveau fichier de script nommé `LogLib.gs`.
3.  Copiez l'intégralité du code source de la bibliothèque dans ce fichier.

### Méthode 2 : En tant que Bibliothèque (Library)
1.  Déployez ce script en tant que bibliothèque dans votre propre environnement.
2.  Notez l'ID du Script (Project Settings > Script ID).
3.  Dans votre projet client : `Éditeur > Bibliothèques > Ajouter une bibliothèque` et collez l'ID.
4.  Utilisez le namespace choisi (ex: `LogLib`).

---

## ⚙ Configuration

Avant toute utilisation, la bibliothèque doit être initialisée. Idéalement, placez ce code en variable globale ou au début de votre fonction `main()`.

```javascript
// Configuration de l'objet
const CONFIG_LOGS = {
  idSpreadsheet: "1xYz_votre_id_spreadsheet_Azk9...", // [OBLIGATOIRE] ID du GSheet
  nomFeuille: "Logs_Production",                      // [OPTIONNEL] Défaut: 'Erreurs'
  emailsAlerte: "admin@societe.com,dev@societe.com",  // [OPTIONNEL] Pour les notifs
  maxLignesLogs: 5000,                                // [OPTIONNEL] Défaut: 2000
  motsClesCritiques: ['FATAL', 'API_DOWN', '404']     // [OPTIONNEL] Déclencheurs d'emails
};

// Initialisation
init(CONFIG_LOGS);
// Si utilisé via bibliothèque externe : LogLib.init(CONFIG_LOGS);
```
Exemple complet

```javascript

const lancerTraitement = () => {
  // 1. INITIALISATION (OBLIGATOIRE)
  // Vous configurez ici votre script spécifique
  LIB_GestionErreurs.init({
    idSpreadsheet: 'xxxxxx', // Votre ID
    emailsAlerte: 'test@email.com',
    maxLignesLogs: 1000 // Optionnel : je veux garder seulement 1000 lignes pour ce projet
  });

  try {
    // ... Code métier ...
    const idClientEnCours = "C-4589";
    const montantCommande = 150.00;

    // Simulation d'erreur
    if (montantCommande > 100) {
      throw new Error("CRITIQUE : Plafond dépassé");
    }

  } catch (e) {
    // 2. APPEL AVEC CONTEXTE
    // Notez le nouvel argument {...} après l'erreur
    const contexte = {
      client: "C-4589",
      montant: 150,
      etape: "Validation Panier"
    };

    LIB_GestionErreurs.journaliserErreur("Script Vente", "lancerTraitement", e, contexte);
  }
};
