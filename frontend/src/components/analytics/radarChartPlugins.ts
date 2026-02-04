// Fonction pour créer le plugin de zones alternées avec le thème (hexagones imbriqués)
export const createRadarAlternatingZonesPlugin = (isDark: boolean) => ({
  id: 'radarAlternatingZones',
  beforeDraw: (chart: any) => {
    const ctx = chart.ctx;
    const scale = chart.scales.r;
    
    if (!scale) return;
    
    // Utiliser les coordonnées du centre du scale radial (plus fiable en responsive)
    const centerX = scale.xCenter;
    const centerY = scale.yCenter;
    const maxRadius = scale.getDistanceFromCenterForValue(scale.max);
    
    // Obtenir le nombre de points (métriques) - devrait être 6 pour un hexagone
    const numPoints = chart.data?.labels?.length || 6;
    
    // Fonction pour calculer les points d'un hexagone à un rayon donné
    const getHexagonPoints = (radius: number) => {
      const points: { x: number; y: number }[] = [];
      const angleStep = (Math.PI * 2) / numPoints;
      
      for (let i = 0; i < numPoints; i++) {
        // Commencer en haut (-Math.PI / 2)
        const angle = -Math.PI / 2 + (i * angleStep);
        points.push({
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        });
      }
      return points;
    };
    
    // Dessiner des zones alternées (hexagones imbriqués)
    const stepSize = scale.options.ticks?.stepSize || 20;
    const steps = Math.floor((scale.max - scale.min) / stepSize);
    
    // Dessiner de l'extérieur vers l'intérieur pour créer les zones imbriquées
    for (let i = steps; i >= 0; i--) {
      const value = i * stepSize;
      const radius = scale.getDistanceFromCenterForValue(value);
      const nextRadius = i < steps ? scale.getDistanceFromCenterForValue(value + stepSize) : maxRadius;
      
      // Alterner les couleurs
      if (i % 2 === 0) {
        ctx.fillStyle = isDark ? 'rgba(55, 65, 81, 0.15)' : 'rgba(229, 231, 235, 0.3)'; // Gris
      } else {
        ctx.fillStyle = isDark ? 'rgba(31, 41, 55, 0.1)' : 'rgba(255, 255, 255, 0.5)'; // Blanc/Gris très clair
      }
      
      // Dessiner un hexagone (zone entre deux hexagones)
      ctx.beginPath();
      
      // Dessiner l'hexagone extérieur
      const outerPoints = getHexagonPoints(nextRadius);
      outerPoints.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      
      // Dessiner l'hexagone intérieur (dans le même sens)
      const innerPoints = getHexagonPoints(radius);
      innerPoints.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      
      // Remplir la zone entre les deux hexagones (evenodd rule crée automatiquement le trou)
      ctx.fill('evenodd');
    }
  }
});

// Fonction pour créer le plugin de dégradé pour le graphique radar
export const createRadarGradientPlugin = (isDark: boolean) => ({
  id: 'radarGradient',
  beforeDatasetsDraw: (chart: any) => {
    const ctx = chart.ctx;
    const scale = chart.scales.r;
    const dataset = chart.data.datasets[0];
    
    if (!scale || !dataset || !dataset.data) return;
    
    // Utiliser les coordonnées du centre du scale radial (plus fiable en responsive)
    const centerX = scale.xCenter;
    const centerY = scale.yCenter;
    
    // Trouver le rayon maximum utilisé par les données
    let maxDataRadius = 0;
    dataset.data.forEach((value: number) => {
      const radius = scale.getDistanceFromCenterForValue(value);
      if (radius > maxDataRadius) {
        maxDataRadius = radius;
      }
    });
    
    // Créer un dégradé radial
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxDataRadius);
    
    // Dégradé violet/bleu selon le thème
    if (isDark) {
      // Mode sombre : dégradé du violet clair au bleu foncé
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)'); // Violet clair au centre
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.3)'); // Indigo au milieu
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)'); // Bleu à l'extérieur
    } else {
      // Mode clair : dégradé du violet clair au bleu clair
      gradient.addColorStop(0, 'rgba(167, 139, 250, 0.35)'); // Violet clair au centre
      gradient.addColorStop(0.5, 'rgba(129, 140, 248, 0.25)'); // Indigo clair au milieu
      gradient.addColorStop(1, 'rgba(96, 165, 250, 0.15)'); // Bleu clair à l'extérieur
    }
    
    // Dessiner le dégradé en suivant la forme du graphique radar
    ctx.save();
    ctx.beginPath();
    
    // Dessiner le polygone du graphique radar
    const dataPoints = dataset.data;
    const angleStep = (Math.PI * 2) / dataPoints.length;
    
    dataPoints.forEach((value: number, index: number) => {
      const angle = -Math.PI / 2 + (index * angleStep); // Commencer en haut
      const radius = scale.getDistanceFromCenterForValue(value);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }
});
