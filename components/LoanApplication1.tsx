import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Package, X } from 'lucide-react';
import { AirtelIcon, OrangeMoneyLogo, useApp } from '../App';
import type { InternetPlan } from '../App';
export type PaymentProvider = 'airtel' | 'orange';

interface LoanApplication1Props {
  selectedPlan: InternetPlan;
  onBack: () => void;
  onSelectProvider: (provider: PaymentProvider) => void;
}

export const LoanApplication1: React.FC<LoanApplication1Props> = ({
  selectedPlan,
  onBack,
  onSelectProvider,
}) => {
  const { language, t } = useApp();

  const providers: {
    id: PaymentProvider;
    name: string;
    subtitle: string;
    accent: string;
    border: string;
    logo: React.ReactNode;
  }[] = [
    {
      id: 'airtel',
      name: 'Airtel Money',
      subtitle: language === 'fr' ? 'Payer avec Airtel Money' : 'Pay with Airtel Money',
      accent: 'from-[#E60000] to-[#c40000]',
      border: 'border-red-500/40 hover:border-red-500',
      logo: (
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#E60000] to-[#c40000] flex items-center justify-center shadow-lg shrink-0">
          <AirtelIcon className="w-8 h-8 sm:w-10 sm:h-10" color="#FFFFFF" />
        </div>
      ),
    },
    {
      id: 'orange',
      name: 'Orange Money',
      subtitle: language === 'fr' ? 'Payer avec Orange Money' : 'Pay with Orange Money',
      accent: 'from-[#FF7A00] to-[#FF5C00]',
      border: 'border-orange-500/40 hover:border-orange-500',
      logo: (
        <OrangeMoneyLogo className="w-14 h-14 sm:w-16 sm:h-16 text-2xl" />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 via-neutral-900 to-black text-white flex flex-col">
      {/* Top bar */}
      <header className="w-full px-4 sm:px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-lg"
        >
          {/* Selected plan pill */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-800 border border-neutral-700">
              <Package className="w-4 h-4 text-neutral-400" />
              <span className="text-sm font-bold text-white">
                {selectedPlan.dataAmount} {selectedPlan.dataUnit}
              </span>
              <span className="text-neutral-500">—</span>
              <span className="text-sm font-bold text-neutral-300">{selectedPlan.price}</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-center mb-2 tracking-tight">
            {language === 'fr' ? 'Choisir le Fournisseur' : 'Choose Provider'}
          </h1>
          <p className="text-sm sm:text-base text-neutral-400 text-center mb-8">
            {language === 'fr'
              ? 'Sélectionnez votre mode de paiement'
              : 'Select your payment method'}
          </p>

          {/* Provider options */}
          <div className="space-y-3 sm:space-y-4">
            {providers.map((provider) => (
              <motion.button
                key={provider.id}
                type="button"
                onClick={() => onSelectProvider(provider.id)}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border-2 ${provider.border} transition-all duration-200 text-left cursor-pointer group`}
              >
                {provider.logo}
                <div className="flex-1 min-w-0">
                  <p className="text-lg sm:text-xl font-black text-white truncate">
                    {provider.name}
                  </p>
                  <p className="text-xs sm:text-sm text-neutral-400 truncate">
                    {provider.subtitle}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
              </motion.button>
            ))}
          </div>

          {/* Cancel */}
          <button
            type="button"
            onClick={onBack}
            className="w-full mt-4 py-3.5 sm:py-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-sm sm:text-base transition-colors"
          >
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </button>
        </motion.div>
      </main>
    </div>
  );
};

