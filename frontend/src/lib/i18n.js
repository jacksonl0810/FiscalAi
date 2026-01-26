/**
 * Internationalization (i18n) Infrastructure for MAY
 * 
 * Provides multi-language support with Portuguese (Brazil) as default.
 * Designed for easy addition of new languages.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Supported locales
export const LOCALES = {
  'pt-BR': {
    name: 'Português (Brasil)',
    flag: '🇧🇷',
    dateFormat: 'dd/MM/yyyy',
    currency: 'BRL',
  },
  'en-US': {
    name: 'English (US)',
    flag: '🇺🇸',
    dateFormat: 'MM/dd/yyyy',
    currency: 'USD',
  },
  'es-ES': {
    name: 'Español',
    flag: '🇪🇸',
    dateFormat: 'dd/MM/yyyy',
    currency: 'EUR',
  },
};

// Default locale
export const DEFAULT_LOCALE = 'pt-BR';

// Translation dictionaries
const translations = {
  'pt-BR': {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.assistant': 'Assistente',
    'nav.documents': 'Documentos',
    'nav.companies': 'Empresas',
    'nav.settings': 'Configurações',
    'nav.notifications': 'Notificações',
    'nav.taxes': 'Impostos',
    'nav.admin': 'Administração',
    'nav.accountant': 'Revisão Contábil',
    
    // Common
    'common.save': 'Salvar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.view': 'Visualizar',
    'common.close': 'Fechar',
    'common.confirm': 'Confirmar',
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.warning': 'Atenção',
    'common.info': 'Informação',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.download': 'Baixar',
    'common.upload': 'Enviar',
    'common.back': 'Voltar',
    'common.next': 'Próximo',
    'common.previous': 'Anterior',
    'common.yes': 'Sim',
    'common.no': 'Não',
    'common.all': 'Todos',
    'common.none': 'Nenhum',
    'common.required': 'Obrigatório',
    'common.optional': 'Opcional',
    
    // Authentication
    'auth.login': 'Entrar',
    'auth.logout': 'Sair',
    'auth.email': 'E-mail',
    'auth.password': 'Senha',
    'auth.forgotPassword': 'Esqueci minha senha',
    'auth.register': 'Criar conta',
    'auth.welcomeBack': 'Bem-vindo de volta!',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.revenue': 'Faturamento',
    'dashboard.invoices': 'Notas Fiscais',
    'dashboard.thisMonth': 'Este mês',
    'dashboard.lastMonth': 'Mês passado',
    'dashboard.companies': 'Empresas',
    'dashboard.pending': 'Pendentes',
    
    // Invoices
    'invoice.title': 'Notas Fiscais',
    'invoice.new': 'Nova Nota Fiscal',
    'invoice.number': 'Número',
    'invoice.date': 'Data',
    'invoice.client': 'Cliente',
    'invoice.value': 'Valor',
    'invoice.status': 'Status',
    'invoice.description': 'Descrição do Serviço',
    'invoice.authorized': 'Autorizada',
    'invoice.rejected': 'Rejeitada',
    'invoice.processing': 'Processando',
    'invoice.draft': 'Rascunho',
    'invoice.cancelled': 'Cancelada',
    'invoice.downloadPdf': 'Baixar PDF',
    'invoice.downloadXml': 'Baixar XML',
    'invoice.cancel': 'Cancelar Nota',
    'invoice.issueSuccess': 'Nota fiscal emitida com sucesso!',
    'invoice.issueError': 'Erro ao emitir nota fiscal',
    
    // Companies
    'company.title': 'Empresas',
    'company.new': 'Nova Empresa',
    'company.name': 'Razão Social',
    'company.tradeName': 'Nome Fantasia',
    'company.cnpj': 'CNPJ',
    'company.address': 'Endereço',
    'company.city': 'Cidade',
    'company.state': 'Estado',
    'company.taxRegime': 'Regime Tributário',
    'company.mei': 'MEI',
    'company.simplesNacional': 'Simples Nacional',
    'company.connected': 'Conectada',
    'company.notConnected': 'Não Conectada',
    'company.connectionFailed': 'Falha na Conexão',
    
    // Assistant
    'assistant.title': 'Assistente Fiscal',
    'assistant.placeholder': 'Digite ou fale seu comando...',
    'assistant.voiceHint': 'Clique no microfone para usar comando de voz',
    'assistant.processing': 'Processando...',
    'assistant.thinking': 'Pensando...',
    'assistant.error': 'Desculpe, ocorreu um erro. Tente novamente.',
    'assistant.help': 'Como posso ajudar?',
    'assistant.suggestions.issue': 'Emitir nota fiscal',
    'assistant.suggestions.list': 'Listar notas do mês',
    'assistant.suggestions.revenue': 'Ver faturamento',
    'assistant.suggestions.taxes': 'Consultar impostos',
    
    // Settings
    'settings.title': 'Configurações',
    'settings.profile': 'Perfil',
    'settings.notifications': 'Notificações',
    'settings.security': 'Segurança',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.dark': 'Escuro',
    'settings.light': 'Claro',
    'settings.system': 'Sistema',
    
    // Subscription
    'subscription.title': 'Assinatura',
    'subscription.plan': 'Plano',
    'subscription.status': 'Status',
    'subscription.active': 'Ativo',
    'subscription.trial': 'Período de Teste',
    'subscription.delinquent': 'Inadimplente',
    'subscription.cancelled': 'Cancelado',
    'subscription.upgrade': 'Fazer Upgrade',
    'subscription.cancel': 'Cancelar Assinatura',
    
    // Errors
    'error.generic': 'Ocorreu um erro inesperado',
    'error.network': 'Erro de conexão. Verifique sua internet.',
    'error.unauthorized': 'Sessão expirada. Faça login novamente.',
    'error.forbidden': 'Você não tem permissão para esta ação.',
    'error.notFound': 'Recurso não encontrado.',
    'error.validation': 'Verifique os dados informados.',
    'error.offline': 'Você está offline.',
    
    // Notifications
    'notification.invoiceIssued': 'Nota fiscal emitida',
    'notification.invoiceRejected': 'Nota fiscal rejeitada',
    'notification.paymentConfirmed': 'Pagamento confirmado',
    'notification.paymentFailed': 'Falha no pagamento',
    'notification.certificateExpiring': 'Certificado expirando',
  },
  
  'en-US': {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.assistant': 'Assistant',
    'nav.documents': 'Documents',
    'nav.companies': 'Companies',
    'nav.settings': 'Settings',
    'nav.notifications': 'Notifications',
    'nav.taxes': 'Taxes',
    'nav.admin': 'Administration',
    'nav.accountant': 'Accountant Review',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Information',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.all': 'All',
    'common.none': 'None',
    'common.required': 'Required',
    'common.optional': 'Optional',
    
    // Authentication
    'auth.login': 'Sign In',
    'auth.logout': 'Sign Out',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot password',
    'auth.register': 'Create account',
    'auth.welcomeBack': 'Welcome back!',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.revenue': 'Revenue',
    'dashboard.invoices': 'Invoices',
    'dashboard.thisMonth': 'This month',
    'dashboard.lastMonth': 'Last month',
    'dashboard.companies': 'Companies',
    'dashboard.pending': 'Pending',
    
    // Invoices
    'invoice.title': 'Invoices',
    'invoice.new': 'New Invoice',
    'invoice.number': 'Number',
    'invoice.date': 'Date',
    'invoice.client': 'Client',
    'invoice.value': 'Value',
    'invoice.status': 'Status',
    'invoice.description': 'Service Description',
    'invoice.authorized': 'Authorized',
    'invoice.rejected': 'Rejected',
    'invoice.processing': 'Processing',
    'invoice.draft': 'Draft',
    'invoice.cancelled': 'Cancelled',
    'invoice.downloadPdf': 'Download PDF',
    'invoice.downloadXml': 'Download XML',
    'invoice.cancel': 'Cancel Invoice',
    'invoice.issueSuccess': 'Invoice issued successfully!',
    'invoice.issueError': 'Error issuing invoice',
    
    // Companies
    'company.title': 'Companies',
    'company.new': 'New Company',
    'company.name': 'Legal Name',
    'company.tradeName': 'Trade Name',
    'company.cnpj': 'Tax ID',
    'company.address': 'Address',
    'company.city': 'City',
    'company.state': 'State',
    'company.taxRegime': 'Tax Regime',
    'company.mei': 'MEI',
    'company.simplesNacional': 'Simples Nacional',
    'company.connected': 'Connected',
    'company.notConnected': 'Not Connected',
    'company.connectionFailed': 'Connection Failed',
    
    // Assistant
    'assistant.title': 'Fiscal Assistant',
    'assistant.placeholder': 'Type or speak your command...',
    'assistant.voiceHint': 'Click the microphone for voice commands',
    'assistant.processing': 'Processing...',
    'assistant.thinking': 'Thinking...',
    'assistant.error': 'Sorry, an error occurred. Please try again.',
    'assistant.help': 'How can I help?',
    'assistant.suggestions.issue': 'Issue invoice',
    'assistant.suggestions.list': 'List this month\'s invoices',
    'assistant.suggestions.revenue': 'View revenue',
    'assistant.suggestions.taxes': 'Check taxes',
    
    // Settings
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.notifications': 'Notifications',
    'settings.security': 'Security',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.system': 'System',
    
    // Subscription
    'subscription.title': 'Subscription',
    'subscription.plan': 'Plan',
    'subscription.status': 'Status',
    'subscription.active': 'Active',
    'subscription.trial': 'Trial Period',
    'subscription.delinquent': 'Delinquent',
    'subscription.cancelled': 'Cancelled',
    'subscription.upgrade': 'Upgrade',
    'subscription.cancel': 'Cancel Subscription',
    
    // Errors
    'error.generic': 'An unexpected error occurred',
    'error.network': 'Connection error. Check your internet.',
    'error.unauthorized': 'Session expired. Please log in again.',
    'error.forbidden': 'You don\'t have permission for this action.',
    'error.notFound': 'Resource not found.',
    'error.validation': 'Please check the provided data.',
    'error.offline': 'You are offline.',
    
    // Notifications
    'notification.invoiceIssued': 'Invoice issued',
    'notification.invoiceRejected': 'Invoice rejected',
    'notification.paymentConfirmed': 'Payment confirmed',
    'notification.paymentFailed': 'Payment failed',
    'notification.certificateExpiring': 'Certificate expiring',
  },
  
  'es-ES': {
    // Navigation
    'nav.dashboard': 'Panel',
    'nav.assistant': 'Asistente',
    'nav.documents': 'Documentos',
    'nav.companies': 'Empresas',
    'nav.settings': 'Configuración',
    'nav.notifications': 'Notificaciones',
    'nav.taxes': 'Impuestos',
    'nav.admin': 'Administración',
    'nav.accountant': 'Revisión Contable',
    
    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.view': 'Ver',
    'common.close': 'Cerrar',
    'common.confirm': 'Confirmar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.warning': 'Advertencia',
    'common.info': 'Información',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.download': 'Descargar',
    'common.upload': 'Subir',
    'common.back': 'Volver',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.required': 'Obligatorio',
    'common.optional': 'Opcional',
    
    // More translations...
    'auth.login': 'Iniciar sesión',
    'auth.logout': 'Cerrar sesión',
    'invoice.title': 'Facturas',
    'invoice.authorized': 'Autorizada',
    'invoice.rejected': 'Rechazada',
    'invoice.processing': 'Procesando',
    'error.generic': 'Ocurrió un error inesperado',
    'error.offline': 'Estás sin conexión.',
  },
};

// Context for i18n
const I18nContext = createContext(null);

/**
 * Get translation for a key
 */
function getTranslation(locale, key, params = {}) {
  const localeTranslations = translations[locale] || translations[DEFAULT_LOCALE];
  let text = localeTranslations[key] || translations[DEFAULT_LOCALE][key] || key;
  
  // Replace parameters
  Object.entries(params).forEach(([paramKey, value]) => {
    text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), value);
  });
  
  return text;
}

/**
 * I18n Provider Component
 */
export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    // Try to get from localStorage or browser
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('may-locale');
      if (stored && LOCALES[stored]) {
        return stored;
      }
      
      // Try browser language
      const browserLang = navigator.language || navigator.userLanguage;
      if (LOCALES[browserLang]) {
        return browserLang;
      }
    }
    return DEFAULT_LOCALE;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('may-locale', locale);
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback((key, params = {}) => {
    return getTranslation(locale, key, params);
  }, [locale]);

  const formatDate = useCallback((date, options = {}) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString(locale, options);
  }, [locale]);

  const formatCurrency = useCallback((value, currency) => {
    const curr = currency || LOCALES[locale]?.currency || 'BRL';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
    }).format(value || 0);
  }, [locale]);

  const formatNumber = useCallback((value, options = {}) => {
    return new Intl.NumberFormat(locale, options).format(value || 0);
  }, [locale]);

  const value = {
    locale,
    setLocale,
    t,
    formatDate,
    formatCurrency,
    formatNumber,
    locales: LOCALES,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to use i18n
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return fallback if not wrapped in provider
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key) => key,
      formatDate: (date) => date?.toString() || '',
      formatCurrency: (value) => `R$ ${value || 0}`,
      formatNumber: (value) => String(value || 0),
      locales: LOCALES,
    };
  }
  return context;
}

/**
 * Hook for just translations (simpler API)
 */
export function useTranslation() {
  const { t } = useI18n();
  return t;
}

export default {
  I18nProvider,
  useI18n,
  useTranslation,
  LOCALES,
  DEFAULT_LOCALE,
};
