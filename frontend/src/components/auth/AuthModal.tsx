import React, { useState, useEffect } from 'react';
import { authService } from '../../services/auth';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialMode = 'login' 
}) => {
  const { t } = useI18nTranslation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Mettre à jour le mode quand initialMode change
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      // Réinitialiser le formulaire quand on change de mode
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: ''
      });
      setError('');
      setSuccessMessage('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [initialMode, isOpen]);

  // Empêcher le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Fonction pour traduire les messages d'erreur du backend
  const translateErrorMessage = (message: string): string => {
    if (!message) return t('auth:errors.registrationFailed');
    
    const messageLower = message.toLowerCase();
    
    // Mapping des messages d'erreur aux clés de traduction
    // Message générique pour éviter de révéler quel champ existe déjà (sécurité)
    if (messageLower.includes('compte avec ces informations') || 
        messageLower.includes('account with these') || 
        messageLower.includes('cuenta con estos') ||
        messageLower.includes('konto mit diesen') ||
        messageLower.includes('account con questi') ||
        messageLower.includes('conta com estes') ||
        messageLower.includes('これらの情報') ||
        messageLower.includes('이러한 정보') ||
        messageLower.includes('这些信息')) {
      return t('auth:errors.accountAlreadyExists');
    }
    if ((messageLower.includes('email') || messageLower.includes('utilisateur') || messageLower.includes('username')) && 
        (messageLower.includes('déjà utilisé') || messageLower.includes('already used') || messageLower.includes('ya está') || messageLower.includes('bereits verwendet') || messageLower.includes('già in uso') || messageLower.includes('já está'))) {
      return t('auth:errors.accountAlreadyExists');
    }
    if (messageLower.includes('mot de passe') && (messageLower.includes('trop court') || messageLower.includes('too short') || messageLower.includes('minimum 8'))) {
      return t('auth:errors.passwordTooShort');
    }
    if (messageLower.includes('mot de passe') && (messageLower.includes('trop commun') || messageLower.includes('too common'))) {
      return t('auth:errors.passwordTooCommon');
    }
    if (messageLower.includes('mot de passe') && (messageLower.includes('similaire') || messageLower.includes('similar'))) {
      return t('auth:errors.passwordTooSimilar');
    }
    if (messageLower.includes('mot de passe') && (messageLower.includes('numérique') || messageLower.includes('numeric'))) {
      return t('auth:errors.passwordNumeric');
    }
    if (messageLower.includes('ne correspondent pas') || messageLower.includes('do not match')) {
      return t('auth:errors.passwordMismatch');
    }
    if (messageLower.includes('email') && messageLower.includes('requis')) {
      return t('auth:errors.emailRequired');
    }
    if (messageLower.includes('email') && messageLower.includes('valide')) {
      return t('auth:errors.emailInvalid');
    }
    if (messageLower.includes('nom d\'utilisateur') && messageLower.includes('requis')) {
      return t('auth:errors.usernameRequired');
    }
    if (messageLower.includes('prénom') && messageLower.includes('requis')) {
      return t('auth:errors.firstNameRequired');
    }
    if (messageLower.includes('nom') && messageLower.includes('requis') && !messageLower.includes('utilisateur')) {
      return t('auth:errors.lastNameRequired');
    }
    
    // Si aucun mapping trouvé, utiliser le message original mais essayer de le formater
    return message;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (mode === 'login') {
        await authService.login(formData.username, formData.password);
        onSuccess();
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error(t('auth:errors.passwordMismatch'));
        }
        if (!formData.firstName || !formData.lastName) {
          throw new Error(t('auth:errors.firstNameRequired') + '\n' + t('auth:errors.lastNameRequired'));
        }
        
        try {
          await authService.register(formData.username, formData.email, formData.password, formData.firstName, formData.lastName);
          // Si on arrive ici, c'est que l'inscription a réussi et que l'utilisateur est connecté
          onSuccess();
        } catch (err: any) {
          // Si c'est une erreur concernant l'activation, afficher un message de succès
          if (err.message && (err.message.includes('email') || err.message.includes('activation') || err.message.includes('activé') || err.message.includes('activated'))) {
            setSuccessMessage(err.message);
            // Réinitialiser le formulaire après 3 secondes
            setTimeout(() => {
              setFormData({
                username: '',
                email: '',
                firstName: '',
                lastName: '',
                password: '',
                confirmPassword: ''
              });
              setSuccessMessage('');
              // Fermer le modal après affichage du message
              setTimeout(() => {
                onClose();
              }, 2000);
            }, 3000);
          } else {
            throw err;
          }
        }
      }
    } catch (err: any) {
      // Traduire le message d'erreur
      const errorMessage = err.message || t('auth:errorOccurred');
      
      // Si le message contient plusieurs lignes, les traduire séparément
      if (errorMessage.includes('\n')) {
        const lines = errorMessage.split('\n');
        const translatedLines = lines.map((line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          
          // Si la ligne contient " : ", c'est un format "Champ : Message"
          if (trimmed.includes(' : ')) {
            const [field, ...messageParts] = trimmed.split(' : ');
            const fieldLabel = field.trim();
            const message = messageParts.join(' : ').trim();
            const translatedField = translateFieldLabel(fieldLabel);
            const translatedMsg = translateErrorMessage(message);
            return `${translatedField} : ${translatedMsg}`;
          }
          // Sinon, essayer de traduire directement
          return translateErrorMessage(trimmed);
        }).filter((line: string) => line.length > 0);
        
        setError(translatedLines.join('\n'));
      } else {
        // Message unique - vérifier s'il contient " : "
        if (errorMessage.includes(' : ')) {
          const [field, ...messageParts] = errorMessage.split(' : ');
          const fieldLabel = field.trim();
          const message = messageParts.join(' : ').trim();
          const translatedField = translateFieldLabel(fieldLabel);
          const translatedMsg = translateErrorMessage(message);
          setError(`${translatedField} : ${translatedMsg}`);
        } else {
          setError(translateErrorMessage(errorMessage));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour traduire les labels de champs
  const translateFieldLabel = (label: string): string => {
    const labelLower = label.toLowerCase();
    if (labelLower.includes('email') || labelLower.includes('adresse email')) {
      return t('auth:email');
    }
    if (labelLower.includes('nom d\'utilisateur') || labelLower.includes('username')) {
      return t('auth:username');
    }
    if (labelLower.includes('mot de passe') || labelLower.includes('password')) {
      return t('auth:password');
    }
    if (labelLower.includes('confirmation') || labelLower.includes('confirm')) {
      return t('auth:confirmPassword');
    }
    if (labelLower.includes('prénom') || labelLower.includes('first name')) {
      return t('auth:firstName');
    }
    if (labelLower.includes('nom') && !labelLower.includes('utilisateur') && !labelLower.includes('username')) {
      return t('auth:lastName');
    }
    return label;
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: ''
    });
    setError('');
    setSuccessMessage('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 border border-gray-100 dark:border-gray-700"
      >
        {/* Header avec onglets */}
        <div className="relative border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-t-2xl">
          {/* Bouton de fermeture avec z-index élevé */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            type="button"
            aria-label="Fermer"
          >
            <svg className="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Onglets */}
          <div className="flex pr-12">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-200 relative ${
                mode === 'login'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {t('auth:connexion')}
              {mode === 'login' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-200 relative ${
                mode === 'register'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {t('auth:inscription')}
              {mode === 'register' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 rounded-t-full" />
              )}
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-4">
          {/* Messages d'alerte */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl mb-4 flex items-start gap-3 animate-in slide-in-from-top-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                {error.split('\n').map((line, index) => (
                  <div key={index} className={index > 0 ? 'mt-1' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl mb-4 flex items-start gap-3 animate-in slide-in-from-top-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="flex-1">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Champ Email/Username selon le mode */}
            {mode === 'login' ? (
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth:email')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth:username')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    placeholder="nom_utilisateur"
                  />
                </div>
              </div>
            )}

            {/* Champs supplémentaires pour l'inscription */}
            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('auth:email')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                      placeholder="votre@email.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('auth:firstName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      autoComplete="given-name"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('auth:lastName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      autoComplete="family-name"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                      placeholder="Nom"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mot de passe */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('auth:password')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirmation mot de passe (inscription uniquement) */}
            {mode === 'register' && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth:confirmPassword')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Note sur les champs obligatoires */}
            {mode === 'register' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="text-red-500">*</span> {t('auth:requiredFields')}
              </p>
            )}

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth:loading')}
                </span>
              ) : (
                mode === 'login' ? t('auth:login') : t('auth:register')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;