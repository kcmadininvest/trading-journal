import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-800 text-gray-300 mt-auto">
      <div className="py-4 px-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 text-center md:text-left">
        <p className="text-sm m-0">
          © {currentYear} Trading Journal. Tous droits réservés.
        </p>
        <div className="flex gap-4 items-center text-sm">
          <a href="#privacy" className="text-gray-400 no-underline transition-colors hover:text-blue-600">
            Confidentialité
          </a>
          <span>•</span>
          <a href="#terms" className="text-gray-400 no-underline transition-colors hover:text-blue-600">
            Conditions
          </a>
          <span>•</span>
          <a href="#about" className="text-gray-400 no-underline transition-colors hover:text-blue-600">
            À propos
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

