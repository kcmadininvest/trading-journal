const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Fonction pour obtenir le dernier tag Git
function getGitVersion() {
  try {
    // Essayer d'obtenir le tag exact du commit actuel
    let version = execSync('git describe --tags --exact-match HEAD 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    // Si pas de tag exact, obtenir le dernier tag avec le nombre de commits depuis
    if (!version) {
      version = execSync('git describe --tags --abbrev=0 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    }
    
    // Nettoyer le tag (enlever le 'v' s'il existe)
    if (version.startsWith('v')) {
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

