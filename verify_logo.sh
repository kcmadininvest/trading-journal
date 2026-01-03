#!/bin/bash

# Script de vérification du logo pour Google
# Vérifie que le logo respecte toutes les exigences de Google

echo "=========================================="
echo "Vérification du Logo - Google Requirements"
echo "=========================================="
echo ""

LOGO_PATH="/var/www/html/trading_journal/frontend/public/logo.png"
LOGO_URL="https://app.kctradingjournal.com/logo.png"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Vérification du fichier local${NC}"
echo "-----------------------------------"

# Vérifier que le fichier existe
if [ -f "$LOGO_PATH" ]; then
    echo -e "${GREEN}✓${NC} Le fichier existe : $LOGO_PATH"
else
    echo -e "${RED}✗${NC} Le fichier n'existe pas : $LOGO_PATH"
    exit 1
fi

# Vérifier les dimensions
if command -v identify &> /dev/null; then
    dimensions=$(identify -format "%wx%h" "$LOGO_PATH" 2>/dev/null)
    if [ "$dimensions" = "512x512" ]; then
        echo -e "${GREEN}✓${NC} Dimensions correctes : 512x512px"
    else
        echo -e "${RED}✗${NC} Dimensions incorrectes : $dimensions (requis: 512x512px)"
    fi
else
    echo -e "${YELLOW}⚠${NC} ImageMagick non installé, impossible de vérifier les dimensions"
    echo "  Installer avec : sudo yum install ImageMagick"
fi

# Vérifier le format
file_type=$(file "$LOGO_PATH" | grep -o "PNG image data")
if [ -n "$file_type" ]; then
    echo -e "${GREEN}✓${NC} Format correct : PNG"
else
    echo -e "${RED}✗${NC} Format incorrect (requis: PNG, JPG ou SVG)"
fi

# Vérifier la taille du fichier
file_size=$(stat -f%z "$LOGO_PATH" 2>/dev/null || stat -c%s "$LOGO_PATH" 2>/dev/null)
file_size_mb=$(echo "scale=2; $file_size / 1048576" | bc 2>/dev/null || echo "N/A")
if [ "$file_size_mb" != "N/A" ]; then
    if (( $(echo "$file_size_mb < 5" | bc -l 2>/dev/null || echo "1") )); then
        echo -e "${GREEN}✓${NC} Taille du fichier : ${file_size_mb}MB (< 5MB)"
    else
        echo -e "${RED}✗${NC} Taille du fichier trop grande : ${file_size_mb}MB (max: 5MB)"
    fi
else
    file_size_kb=$(echo "scale=2; $file_size / 1024" | bc 2>/dev/null || echo "N/A")
    echo -e "${GREEN}✓${NC} Taille du fichier : ${file_size_kb}KB"
fi

echo ""
echo -e "${BLUE}2. Vérification de l'accessibilité en ligne${NC}"
echo "--------------------------------------------"

# Vérifier que le logo est accessible via HTTP
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$LOGO_URL" 2>/dev/null)
if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓${NC} Logo accessible : $LOGO_URL (HTTP $http_code)"
else
    echo -e "${RED}✗${NC} Logo non accessible : $LOGO_URL (HTTP $http_code)"
fi

# Vérifier le Content-Type
content_type=$(curl -s -I "$LOGO_URL" 2>/dev/null | grep -i "content-type" | awk '{print $2}' | tr -d '\r')
if echo "$content_type" | grep -q "image/png"; then
    echo -e "${GREEN}✓${NC} Content-Type correct : $content_type"
else
    echo -e "${RED}✗${NC} Content-Type incorrect : $content_type (requis: image/png)"
fi

# Vérifier HTTPS
if echo "$LOGO_URL" | grep -q "https://"; then
    echo -e "${GREEN}✓${NC} URL en HTTPS"
else
    echo -e "${RED}✗${NC} URL non sécurisée (HTTPS requis)"
fi

echo ""
echo -e "${BLUE}3. Vérification des données structurées${NC}"
echo "----------------------------------------"

# Vérifier la présence du JSON-LD
json_ld=$(curl -s "$LOGO_URL" 2>/dev/null | grep -A 20 "application/ld+json" | grep "logo")
if [ -n "$json_ld" ]; then
    echo -e "${GREEN}✓${NC} JSON-LD avec logo trouvé dans le HTML"
else
    echo -e "${YELLOW}⚠${NC} JSON-LD non trouvé (vérifier manuellement)"
fi

# Vérifier organization.json
org_json=$(curl -s "https://app.kctradingjournal.com/organization.json" 2>/dev/null)
if echo "$org_json" | grep -q "logo"; then
    echo -e "${GREEN}✓${NC} Logo référencé dans organization.json"
else
    echo -e "${RED}✗${NC} Logo non trouvé dans organization.json"
fi

# Vérifier le sitemap
sitemap=$(curl -s "https://app.kctradingjournal.com/sitemap.xml" 2>/dev/null)
if echo "$sitemap" | grep -q "logo.png"; then
    echo -e "${GREEN}✓${NC} Logo référencé dans sitemap.xml"
else
    echo -e "${RED}✗${NC} Logo non trouvé dans sitemap.xml"
fi

echo ""
echo -e "${BLUE}4. Résumé des exigences Google${NC}"
echo "--------------------------------"

echo ""
echo "Exigences pour l'affichage du logo dans Google :"
echo ""
echo "  ✓ Format : PNG, JPG ou SVG"
echo "  ✓ Dimensions : 512x512px (recommandé)"
echo "  ✓ Taille : < 5MB"
echo "  ✓ URL : HTTPS"
echo "  ✓ Accessible : HTTP 200"
echo "  ✓ Données structurées : JSON-LD avec @type Organization"
echo "  ✓ Propriété logo : URL complète du logo"
echo ""

echo -e "${BLUE}5. Prochaines étapes${NC}"
echo "--------------------"
echo ""
echo "1. Si tous les tests sont ✓, soumettre à Google Search Console"
echo "2. Utiliser l'outil de test : https://search.google.com/test/rich-results"
echo "3. Valider avec Schema.org : https://validator.schema.org/"
echo "4. Attendre 2-4 semaines pour l'indexation"
echo ""

echo -e "${BLUE}6. Tests supplémentaires recommandés${NC}"
echo "-------------------------------------"
echo ""
echo "# Vérifier le JSON-LD dans le HTML"
echo "curl https://app.kctradingjournal.com/ | grep -A 20 'application/ld+json'"
echo ""
echo "# Vérifier les dimensions avec ImageMagick"
echo "identify -verbose $LOGO_PATH | grep -E '(Geometry|Format)'"
echo ""
echo "# Télécharger le logo pour inspection"
echo "curl -o /tmp/logo_test.png $LOGO_URL"
echo ""

echo "=========================================="
echo "Fin de la vérification"
echo "=========================================="

