import Constants from 'expo-constants';

type AppIdentity = {
  appDisplayName: string;
  appScheme: string;
  appDomain: string;
  supportEmail: string;
  iosMerchantIdentifier: string;
};

const configured = Constants.expoConfig?.extra?.appIdentity as Partial<AppIdentity> | undefined;

export const BUILD_APP_IDENTITY: AppIdentity = {
  appDisplayName: configured?.appDisplayName || Constants.expoConfig?.name || 'Local Marketplace',
  appScheme: configured?.appScheme || 'localmarketplace',
  appDomain: configured?.appDomain || 'yourdomain.com',
  supportEmail: configured?.supportEmail || 'support@yourdomain.com',
  iosMerchantIdentifier:
    configured?.iosMerchantIdentifier || 'merchant.com.example.localmarketplace',
};
