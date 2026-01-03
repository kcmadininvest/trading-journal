#!/bin/bash

# Script de test SEO pour K&C Trading Journal
# Vérifie que tous les éléments SEO sont en place

echo "=========================================="
echo "Test SEO - K&C Trading Journal"
echo "=========================================="
echo ""

BASE_URL="https://app.kctradingjournal.com"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester une URL
test_url() {
    local url=$1
    local description=$2
    local expected_content=$3
    
    echo -n "Test: $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        if [ -n "$expected_content" ]; then
            content=$(curl -s "$url" 2>/dev/null)
            if echo "$content" | grep -q "$expected_content"; then
                echo -e "${GREEN}✓ OK${NC} (200 - Contenu trouvé)"
            else
                echo -e "${YELLOW}⚠ ATTENTION${NC} (200 - Contenu non trouvé: $expected_content)"
            fi
        else
            echo -e "${GREEN}✓ OK${NC} (200)"
        fi
    else
        echo -e "${RED}✗ ÉCHEC${NC} ($response)"
    fi
}

# Fonction pour tester le contenu d'une URL
test_content() {
    local url=$1
    local description=$2
    local pattern=$3
    
    echo -n "Test: $description... "
    
    content=$(curl -s "$url" 2>/dev/null)
    
    if echo "$content" | grep -q "$pattern"; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ ÉCHEC${NC} (Pattern non trouvé: $pattern)"
    fi
}

echo "1. Tests des fichiers de base"
echo "------------------------------"
test_url "$BASE_URL/robots.txt" "robots.txt" "Sitemap:"
test_url "$BASE_URL/sitemap.xml" "sitemap.xml" "<urlset"
test_url "$BASE_URL/logo.png" "logo.png" ""
test_url "$BASE_URL/og-image.png" "og-image.png" ""
test_url "$BASE_URL/manifest.json" "manifest.json" ""
echo ""

echo "2. Tests du sitemap"
echo "-------------------"
test_content "$BASE_URL/sitemap.xml" "Namespace images" "xmlns:image"
test_content "$BASE_URL/sitemap.xml" "Balise image:image" "<image:image>"
test_content "$BASE_URL/sitemap.xml" "Logo référencé" "/logo.png"
test_content "$BASE_URL/sitemap.xml" "Page d'accueil" "<loc>$BASE_URL/</loc>"
test_content "$BASE_URL/sitemap.xml" "Page à propos FR" "<loc>$BASE_URL/a-propos</loc>"
test_content "$BASE_URL/sitemap.xml" "Page about EN" "<loc>$BASE_URL/about</loc>"
echo ""

echo "3. Tests des données structurées"
echo "---------------------------------"
test_url "$BASE_URL/organization.json" "organization.json" "Organization"
test_content "$BASE_URL/organization.json" "Logo dans JSON" "logo.png"
test_content "$BASE_URL/organization.json" "Type Organization" '"@type": "Organization"'
test_content "$BASE_URL/" "JSON-LD dans HTML" '"@type": "Organization"'
test_content "$BASE_URL/" "Logo dans JSON-LD" 'logo.png'
echo ""

echo "4. Tests des meta tags"
echo "----------------------"
test_content "$BASE_URL/" "Meta description" '<meta name="description"'
test_content "$BASE_URL/" "Meta robots" '<meta name="robots"'
test_content "$BASE_URL/" "Open Graph image" '<meta property="og:image"'
test_content "$BASE_URL/" "Open Graph logo" '<meta property="og:logo"'
test_content "$BASE_URL/" "Canonical URL" '<link rel="canonical"'
echo ""

echo "5. Tests des images"
echo "-------------------"
# Vérifier que les images sont accessibles et ont le bon type
logo_type=$(curl -s -I "$BASE_URL/logo.png" 2>/dev/null | grep -i "content-type" | awk '{print $2}')
echo -n "Test: Type MIME du logo... "
if echo "$logo_type" | grep -q "image/png"; then
    echo -e "${GREEN}✓ OK${NC} ($logo_type)"
else
    echo -e "${RED}✗ ÉCHEC${NC} ($logo_type)"
fi

og_type=$(curl -s -I "$BASE_URL/og-image.png" 2>/dev/null | grep -i "content-type" | awk '{print $2}')
echo -n "Test: Type MIME de og-image... "
if echo "$og_type" | grep -q "image/png"; then
    echo -e "${GREEN}✓ OK${NC} ($og_type)"
else
    echo -e "${RED}✗ ÉCHEC${NC} ($og_type)"
fi
echo ""

echo "6. Résumé et recommandations"
echo "-----------------------------"
echo ""
echo "✓ Si tous les tests sont OK, vous pouvez :"
echo "  1. Soumettre le sitemap dans Google Search Console"
echo "  2. Utiliser l'outil de test des résultats enrichis : https://search.google.com/test/rich-results"
echo "  3. Valider les données structurées : https://validator.schema.org/"
echo ""
echo "⚠ Délais d'indexation :"
echo "  - Sitemap : 1-7 jours"
echo "  - Logo Google : 2-4 semaines"
echo ""
echo "=========================================="
echo "Fin des tests"
echo "=========================================="

