const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Fonction pour obtenir le dernier tag Git
function getGitVersion() {
  try {
    // S'assurer que les tags distants sont récupérés
    try {
      execSync('git fetch --tags --quiet 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        cwd: path.join(__dirname, '../..')
      });
    } catch (e) {
      // Ignorer les erreurs de fetch
    }
    
    // Essayer d'obtenir le tag exact du commit actuel
    let version = '';
    try {
      version = execSync('git describe --tags --exact-match HEAD 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
        cwd: path.join(__dirname, '../..')
      }).trim();
    } catch (e) {
      // Pas de tag exact, continuer
    }
    
    // Si pas de tag exact, obtenir le dernier tag (trié par version)
    if (!version) {
      try {
        // Récupérer tous les tags et trier par version
        const tags = execSync('git tag --sort=-v:refname 2>/dev/null', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
          cwd: path.join(__dirname, '../..')
        }).trim();
        
        if (tags) {
          // Prendre le premier tag (le plus récent)
          version = tags.split('\n')[0].trim();
        }
      } catch (e) {
        // Essayer la méthode alternative
        try {
          version = execSync('git describe --tags --abbrev=0 2>/dev/null', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: path.join(__dirname, '../..')
          }).trim();
        } catch (e2) {
          // Pas de tags disponibles
        }
      }
    }
    
    // Nettoyer le tag (enlever le 'v' s'il existe)
    if (version && version.startsWith('v')) {
      version = version.substring(1);
    }
    
    return version || '0.0.0';
  } catch (error) {
    // Si Git n'est pas disponible ou pas de tags, utiliser la version du package.json
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
      return packageJson.version || '0.0.0';
    } catch (e) {
      return '0.0.0';
    }
  }
}

// Générer le fichier de version
const version = getGitVersion();
const versionFile = path.join(__dirname, '../src/version.ts');

const content = `// ⚠️ Fichier généré automatiquement - Ne pas modifier manuellement
// Ce fichier est généré par scripts/generate-version.js lors du build

export const VERSION = '${version}';
export default VERSION;
`;

fs.writeFileSync(versionFile, content, 'utf-8');
console.log(`✅ Version générée: ${version}`);

