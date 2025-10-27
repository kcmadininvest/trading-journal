import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { tradesService } from '../../services/trades';
import FileUpload from '../common/FileUpload';
import Button from '../common/Button';
import TradingAccountSelector from '../TradingAccount/TradingAccountSelector';
import { TradingAccount } from '../../types';

interface GlobalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
}


const GlobalImportModal: React.FC<GlobalImportModalProps> = ({ isOpen, onClose, onImported }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [selectorKey, setSelectorKey] = useState(0);

  // Réinitialiser l'état quand la modale s'ouvre
  useEffect(() => {
    if (isOpen) {
      setSelectedAccount(null);
      setSelectedFile(null);
      setSelectorKey(prev => prev + 1); // Forcer le rechargement du sélecteur
    }
  }, [isOpen]); // Retirer selectedAccount des dépendances pour éviter la boucle infinie

  // Écouter les événements de mise à jour des comptes
  useEffect(() => {
    const handleAccountsUpdate = () => {
      // Forcer la mise à jour du sélecteur de comptes
    };

    window.addEventListener('trades:updated', handleAccountsUpdate);
    window.addEventListener('user:login', handleAccountsUpdate);
    
    return () => {
      window.removeEventListener('trades:updated', handleAccountsUpdate);
      window.removeEventListener('user:login', handleAccountsUpdate);
    };
  }, []);

  // Forcer la mise à jour après un délai pour s'assurer que le sélecteur est chargé
  useEffect(() => {
    if (isOpen && !selectedAccount) {
      const timer = setTimeout(() => {
        // Forcer le rechargement du sélecteur si aucun compte n'est sélectionné
        setSelectorKey(prev => prev + 1);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedAccount]);

  // Gérer la sélection automatique du compte par défaut
  const handleAccountChange = (account: TradingAccount | null) => {
    setSelectedAccount(account);
  };

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    if (!selectedAccount) {
      toast.error('Veuillez sélectionner un compte de trading');
      return;
    }

    setIsLoading(true);
    try {
      const result = await tradesService.uploadCSV(selectedFile, selectedAccount.id);
      if (result.success) {
        toast.success(result.message, { duration: 5000 });
        setSelectedFile(null);
        
        // Déclencher l'événement de mise à jour
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('trades:updated'));
        }
        
        onImported && onImported();
        handleClose();
      } else {
        toast.error(result.error || "Erreur lors de l'import");
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'import:', error);
      toast.error(error?.response?.data?.error || "Erreur lors de l'upload du fichier");
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const getAcceptTypes = () => {
    return '.csv';
  };

  const getDescription = () => {
    return 'Importez vos trades TopStep depuis un fichier CSV';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📥</span>
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 m-0">
              Importer des trades TopStep
            </h3>
          </div>
          <button 
            className="text-gray-500 hover:text-gray-700 bg-transparent border-none" 
            onClick={handleClose} 
            aria-label="Fermer"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-5">{getDescription()}</p>

        {/* Format CSV attendu */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Format CSV attendu</h4>
          <div className="text-xs text-blue-800 space-y-1">
            <p><strong>Colonnes requises :</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li><code>Id</code> - Identifiant unique du trade (ex: 1381042776)</li>
              <li><code>ContractName</code> - Nom du contrat (ex: NQZ5)</li>
              <li><code>EnteredAt</code> - Date/heure d'entrée (ex: 09/23/2025 18:53:51 +02:00)</li>
              <li><code>ExitedAt</code> - Date/heure de sortie (ex: 09/23/2025 18:55:05 +02:00)</li>
              <li><code>EntryPrice</code> - Prix d'entrée (ex: 24942.000000000)</li>
              <li><code>ExitPrice</code> - Prix de sortie (ex: 24931.750000000)</li>
              <li><code>Fees</code> - Frais de transaction (ex: 8.40000)</li>
              <li><code>PnL</code> - Profit/Loss (ex: -615.000000000)</li>
              <li><code>Size</code> - Taille de la position (ex: 3)</li>
              <li><code>Type</code> - Type de trade (ex: Long ou Short)</li>
              <li><code>TradeDay</code> - Jour de trading (ex: 09/23/2025 00:00:00 -05:00)</li>
              <li><code>TradeDuration</code> - Durée du trade (ex: 00:01:14.1109220)</li>
              <li><code>Commissions</code> - Commissions (ex: vide ou 0.00)</li>
            </ul>
            <p className="mt-2"><strong>Note :</strong> Le fichier doit contenir une ligne d'en-tête avec les noms des colonnes.</p>
            <p><strong>Séparateur :</strong> Virgule (,) - Format CSV standard</p>
          </div>
        </div>

        {/* Sélecteur de compte de trading */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Compte de trading
          </label>
          <TradingAccountSelector
            key={selectorKey}
            selectedAccountId={selectedAccount?.id}
            onAccountChange={handleAccountChange}
            className="w-full"
          />
          {selectedAccount && (
            <p className="text-xs text-gray-500 mt-1">
              Les trades seront importés dans le compte "{selectedAccount.name}"
            </p>
          )}
        </div>

        <FileUpload 
          onFileSelect={handleFileSelect} 
          accept={getAcceptTypes()} 
          loading={isLoading}
          maxSize={10 * 1024 * 1024} // 10MB
        />

        {/* Footer */}
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          {!selectedAccount ? (
            <Button 
              variant="primary" 
              onClick={() => {
                handleClose();
                window.location.hash = '#trading-accounts';
              }}
              disabled={isLoading}
            >
              Créer un compte de trading
            </Button>
          ) : (
            <Button 
              variant="primary" 
              onClick={handleUpload} 
              loading={isLoading} 
              disabled={!selectedFile}
            >
              {isLoading ? 'Import en cours...' : 'Importer le fichier'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalImportModal;