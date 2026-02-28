import React, { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getFullMediaUrl } from '../../utils/mediaUrl';

interface ComplianceScreenshot {
  id: number;
  screenshot_url: string;
  date: string;
}

interface ComplianceScreenshotsProps {
  date: string;
  tradingAccountId?: number;
}

export const ComplianceScreenshots: React.FC<ComplianceScreenshotsProps> = ({
  date,
  tradingAccountId,
}) => {
  const [screenshots, setScreenshots] = useState<ComplianceScreenshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadScreenshots = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const baseUrl = getApiBaseUrl();
        let url = `${baseUrl}/api/trades/day-strategy-compliance/by_date/?date=${date}`;
        
        if (tradingAccountId) {
          url += `&trading_account=${tradingAccountId}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Filtrer uniquement ceux qui ont un screenshot
          const withScreenshots = data.filter((item: any) => item.screenshot_url);
          setScreenshots(withScreenshots);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des screenshots:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreenshots();
  }, [date, tradingAccountId]);

  if (isLoading || screenshots.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {screenshots.map((screenshot) => (
        <div key={screenshot.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Strategy Compliance
            </span>
          </div>
          <img
            src={getFullMediaUrl(screenshot.screenshot_url)}
            alt="Strategy Compliance Screenshot"
            className="w-full h-40 object-cover rounded-md"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};
