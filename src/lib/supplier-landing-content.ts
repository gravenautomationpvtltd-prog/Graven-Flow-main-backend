export interface CountryContent {
  code: string;
  name: string;
  flag: string;
  headline: string;
  subheadline: string;
  currency: string;
  currencySymbol: string;
  greeting: string;
  benefits: string[];
  documentHints: {
    gst: string;
    pan: string;
  };
}

export const countryContent: Record<string, CountryContent> = {
  india: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    headline: 'Become a Graven Automation Supplier',
    subheadline: "Join India's fastest-growing industrial automation network",
    currency: 'INR',
    currencySymbol: '₹',
    greeting: 'नमस्ते',
    benefits: [
      'Direct partnership with leading automation distributor',
      'Regular high-volume orders',
      'Timely payments with flexible terms',
      'Long-term business relationships',
    ],
    documentHints: {
      gst: 'GST Certificate (Mandatory)',
      pan: 'PAN Card (Mandatory)',
    },
  },
  china: {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    headline: 'Partner with Graven Automation',
    subheadline: "Connect with India's industrial automation leader",
    currency: 'CNY',
    currencySymbol: '¥',
    greeting: '你好',
    benefits: [
      'Access to growing Indian market',
      'Consistent order volumes',
      'Professional procurement team',
      'Export-friendly payment terms',
    ],
    documentHints: {
      gst: 'Business Registration Certificate',
      pan: 'Tax Registration Document',
    },
  },
  singapore: {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    headline: 'Partner with Graven Automation',
    subheadline: 'Expand your reach to the Indian automation market',
    currency: 'SGD',
    currencySymbol: 'S$',
    greeting: 'Welcome',
    benefits: [
      'Strategic partnership opportunities',
      'Growing industrial automation demand',
      'Reliable payment schedules',
      'Professional business practices',
    ],
    documentHints: {
      gst: 'GST Registration Certificate',
      pan: 'ACRA Business Profile',
    },
  },
  japan: {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    headline: 'Partner with Graven Automation',
    subheadline: 'Bring Japanese precision to Indian industry',
    currency: 'JPY',
    currencySymbol: '¥',
    greeting: 'こんにちは',
    benefits: [
      'Strong demand for Japanese automation products',
      'Long-term partnership focus',
      'Transparent procurement process',
      'Quality-conscious buyer base',
    ],
    documentHints: {
      gst: 'Certificate of Registration',
      pan: 'Corporate Number Certificate',
    },
  },
  vietnam: {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    headline: 'Partner with Graven Automation',
    subheadline: 'Access India\'s industrial automation market',
    currency: 'VND',
    currencySymbol: '₫',
    greeting: 'Xin chào',
    benefits: [
      'Growing partnership opportunities',
      'Consistent order pipeline',
      'Fair and transparent dealings',
      'Support for new suppliers',
    ],
    documentHints: {
      gst: 'Business Registration Certificate',
      pan: 'Tax Code Certificate',
    },
  },
  taiwan: {
    code: 'TW',
    name: 'Taiwan',
    flag: '🇹🇼',
    headline: 'Partner with Graven Automation',
    subheadline: 'Bring Taiwan excellence to Indian industry',
    currency: 'TWD',
    currencySymbol: 'NT$',
    greeting: '你好',
    benefits: [
      'High demand for Taiwan automation products',
      'Professional business relationships',
      'Regular procurement cycles',
      'Competitive payment terms',
    ],
    documentHints: {
      gst: 'Company Registration Certificate',
      pan: 'Unified Business Number Certificate',
    },
  },
  malaysia: {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    headline: 'Partner with Graven Automation',
    subheadline: 'Expand your business to India',
    currency: 'MYR',
    currencySymbol: 'RM',
    greeting: 'Selamat datang',
    benefits: [
      'Strategic market expansion',
      'Growing industrial automation sector',
      'Reliable payment commitments',
      'Long-term business vision',
    ],
    documentHints: {
      gst: 'SST Registration Certificate',
      pan: 'Company Registration (SSM)',
    },
  },
};

export const defaultContent: CountryContent = {
  code: 'INTL',
  name: 'International',
  flag: '🌍',
  headline: 'Become a Graven Automation Supplier',
  subheadline: 'Partner with India\'s trusted industrial automation distributor',
  currency: 'USD',
  currencySymbol: '$',
  greeting: 'Welcome',
  benefits: [
    'Access to India\'s growing automation market',
    'Professional procurement process',
    'Reliable payment schedules',
    'Long-term partnership opportunities',
  ],
  documentHints: {
    gst: 'Business Registration Certificate',
    pan: 'Tax Registration Document',
  },
};

export function getCountryContent(countrySlug?: string): CountryContent {
  if (!countrySlug) return defaultContent;
  return countryContent[countrySlug.toLowerCase()] || defaultContent;
}

export const supportedCountries = Object.entries(countryContent).map(([slug, content]) => ({
  slug,
  ...content,
}));

export const companyInfo = {
  name: 'Graven Automation Private Limited',
  tagline: 'Your Trusted Partner in Industrial Automation',
  description: `Graven Automation is a leading distributor of industrial automation products in India. 
With over a decade of experience, we specialize in sourcing high-quality automation components 
from global manufacturers and delivering them to industries across the country.`,
  stats: [
    { label: 'Years in Business', value: '10+' },
    { label: 'Products Distributed', value: '500+' },
    { label: 'Clients Served', value: '200+' },
    { label: 'Cities Covered', value: '50+' },
  ],
  expertise: [
    'PLCs & HMIs',
    'Variable Frequency Drives',
    'Sensors & Encoders',
    'Industrial Motors',
    'Motion Control Systems',
    'Industrial Networking',
  ],
  contactEmail: 'procurement@gravenautomation.com',
  contactPhone: '+91 522 XXX XXXX',
  address: 'Lucknow, Uttar Pradesh, India',
};

// Portal configuration for the new dark-themed landing page
export const portalConfig = {
  whyCards: [
    { 
      title: "Structured RFQs Only", 
      desc: "No vague enquiries. Clear specs, quantities, and timelines. Quote professionally.", 
      icon: "FileText" 
    },
    { 
      title: "Global Reach", 
      desc: "One portal. Multiple countries. Quote in your preferred currency with system-driven FX.", 
      icon: "Globe" 
    },
    { 
      title: "Secure & NDA", 
      desc: "Your data stays yours. Role-based access and NDA accepted during onboarding.", 
      icon: "Shield" 
    },
    { 
      title: "Performance & Growth", 
      desc: "Data-driven insights to help you scale your business and recurring revenue.", 
      icon: "TrendingUp",
      kpis: [
        { label: "Revenue Growth", val: "+24% Avg" }, 
        { label: "Repeat Biz", val: "82%" }
      ] 
    },
    { 
      title: "Payments & Cash Flow", 
      desc: "Full cash flow visibility and transaction control. Non-negotiable liquidity focus.", 
      icon: "Wallet", 
      isFeatured: true,
      kpis: [
        { label: "Pending", val: "₹0.00", color: "#3fb950" }, 
        { label: "Success Rate", val: "99.9%" }
      ] 
    },
    { 
      title: "Long-Term Opportunity", 
      desc: "Internal supplier ratings and performance-based preference for future contract workflows.", 
      icon: "Handshake" 
    }
  ],
  categories: [
    { name: "PLC, VFD & HMI", icon: "Cpu" },
    { name: "Robots & Cobots", icon: "Bot" },
    { name: "Transformers & Gensets", icon: "Zap" },
    { name: "Wire & Cables", icon: "Cable" },
    { name: "SCADA & IoT", icon: "Radio" },
    { name: "Control Panel Components", icon: "CircuitBoard" },
    { name: "Motors & Drives", icon: "Cog" },
    { name: "Sensors & Instrumentation", icon: "Compass" },
    { name: "OEMs & Manufacturers", icon: "Factory" },
    { name: "Authorized Distributors", icon: "Truck" }
  ],
  prepDocs: [
    "Company Registration",
    "Tax / GST / VAT Details", 
    "Company Profile",
    "Product Catalog",
    "ISO / CE Certifications"
  ]
};
