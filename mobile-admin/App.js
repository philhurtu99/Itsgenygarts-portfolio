import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, NativeModules, PermissionsAndroid, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { adminApi } from './src/api';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL || 'http://localhost:3002';
const ADMIN_TOKEN_STORAGE_KEY = 'itsgenygarts_admin_token';
const PUSH_TOKEN_STORAGE_KEY = 'itsgenygarts_admin_push_token';
const PUSH_SUCCESS_NOTICE_STORAGE_KEY = 'itsgenygarts_admin_push_success_notice_shown';
const APP_TOP_INSET = Platform.OS === 'android' ? Math.max(Constants.statusBarHeight || 0, 24) : 0;
const APP_BOTTOM_INSET = Platform.OS === 'android' ? 56 : 0;
const ADMIN_ORIGIN = (() => {
  try {
    return new URL(ADMIN_URL).origin;
  } catch {
    return null;
  }
})();
const ADMIN_BASE_PATH = (() => {
  try {
    const pathname = new URL(ADMIN_URL).pathname || '/';
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  } catch {
    return null;
  }
})();

function isTrustedAdminUrl(value) {
  try {
    const url = new URL(value);
    if (!ADMIN_ORIGIN || !ADMIN_BASE_PATH || url.origin !== ADMIN_ORIGIN) return false;
    if (!__DEV__ && url.protocol !== 'https:') return false;
    if (ADMIN_BASE_PATH === '/') return true;
    return url.pathname === ADMIN_BASE_PATH.slice(0, -1)
      || url.pathname.startsWith(ADMIN_BASE_PATH);
  } catch {
    return false;
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let terminalModule = null;
try {
  if (Platform.OS !== 'web' && NativeModules.StripeTerminalReactNative) {
    terminalModule = require('@stripe/stripe-terminal-react-native');
  }
} catch {
  terminalModule = null;
}

function postWebViewEvent(webviewRef, type, payload = {}) {
  const script = `
    window.dispatchEvent(new CustomEvent(${JSON.stringify(type)}, { detail: ${JSON.stringify(payload)} }));
    true;
  `;
  webviewRef.current?.injectJavaScript(script);
}

function getNotificationPath(response) {
  const path = response?.notification?.request?.content?.data?.path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}

function navigateWebView(webviewRef, path) {
  if (!path) return;
  const script = `
    window.history.pushState({}, '', ${JSON.stringify(path)});
    window.dispatchEvent(new PopStateEvent('popstate'));
    true;
  `;
  webviewRef.current?.injectJavaScript(script);
}

async function registerForPushNotifications(adminToken) {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) throw new Error('Les push notifications demandent un vrai téléphone.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('admin-alerts', {
      name: 'Alertes admin',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DD7A8F',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let finalStatus = current.status;
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') throw new Error('Permission de notifications refusée.');

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    throw new Error('Projet EAS manquant pour générer le token push. Lance `npx eas-cli login` puis `npx eas-cli init` dans mobile-admin.');
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushToken = tokenResult.data;

  await adminApi.registerPushToken(adminToken, {
    token: pushToken,
    platform: Platform.OS,
    deviceName: Device.deviceName || Device.modelName || null,
    appVersion: Constants?.expoConfig?.version || null,
  });

  return pushToken;
}

function pushErrorMessage(err) {
  const message = err?.message || 'Erreur inconnue.';
  if (message.includes('aps-environment') || message.includes('entitlement')) {
    return 'Notifications push: entitlement iOS manquant ou profil Apple non mis à jour. Rebuild l’app après avoir activé Push Notifications.';
  }
  return `Notifications push: ${message}`;
}

const webViewBootstrapScript = `
  (function () {
    var tokenKey = ${JSON.stringify(ADMIN_TOKEN_STORAGE_KEY)};
    var lastToken = null;
    function sendAdminToken() {
      try {
        var token = window.localStorage && window.localStorage.getItem(tokenKey);
        if (token && token !== lastToken && window.ReactNativeWebView) {
          lastToken = token;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ADMIN_AUTH_TOKEN', token: token }));
        }
      } catch (err) {}
    }
    sendAdminToken();
    window.addEventListener('storage', sendAdminToken);
    window.addEventListener('focus', sendAdminToken);
    window.setInterval(sendAdminToken, 4000);
  })();
  true;
`;

function tapToPaySupportMessage(support) {
  const detail = support?.error?.message || support?.error?.code || '';
  const suffix = detail ? ` Détail Stripe: ${detail}` : '';

  if (Platform.OS === 'android') {
    return `Ce téléphone Android ne supporte pas Tap to Pay ou n’est pas prêt. Vérifie Android 13+, NFC activé, Google Play Services, téléphone non rooté et options développeur désactivées.${suffix}`;
  }

  if (Platform.OS === 'ios') {
    return `Cet iPhone ne supporte pas Tap to Pay. Il faut un iPhone XS ou plus récent avec iOS supporté et les entitlements Stripe/Apple actifs.${suffix}`;
  }

  return `Tap to Pay n’est disponible que sur une build native Android ou iOS.${suffix}`;
}

function normalizeTapToPayErrorMessage(err) {
  const raw = err?.message || String(err || '');
  const lower = raw.toLowerCase();

  if (lower.includes('aidlrpc') || lower.includes('aidl server')) {
    return [
      'Erreur interne Stripe/Android pendant la lecture NFC.',
      'Réessaie après avoir fermé les apps ouvertes, désactivé les bulles/overlays et vérifié que NFC + Google Play Services sont actifs.',
      'Si ça revient, redémarre le téléphone et essaie une autre carte ou un portefeuille mobile. Au Canada, certaines cartes PIN/offline peuvent devoir passer par un lien Stripe ou un autre moyen de paiement.',
    ].join(' ');
  }

  if (lower.includes('tap_to_pay_insecure_environment') || lower.includes('insecure')) {
    return 'Tap to Pay a détecté un environnement non sécurisé. Désactive les options développeur, les overlays/bulles flottantes, l’enregistrement d’écran et les services d’accessibilité actifs, puis réessaie.';
  }

  return raw;
}

function getTapToPayConnectParams(config) {
  const params = {
    discoveryMethod: 'tapToPay',
    simulated: false,
    locationId: config.locationId,
    autoReconnectOnUnexpectedDisconnect: true,
  };

  if (Platform.OS === 'ios') {
    params.merchantDisplayName = config.merchantDisplayName || 'Itsgenygarts';
    params.tosAcceptancePermitted = true;
  }

  return params;
}

async function ensureTapToPayPermissions() {
  if (Platform.OS !== 'android') return;

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Localisation requise',
    message: 'Stripe Tap to Pay demande la localisation pour découvrir le lecteur de paiement intégré au téléphone.',
    buttonPositive: 'Autoriser',
    buttonNegative: 'Refuser',
  });

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Permission localisation refusée. Active-la pour utiliser Tap to Pay.');
  }
}

function TapToPayBridge({ terminal, webviewRef, tokenRef, setBusyStatus }) {
  const {
    initialize,
    easyConnect,
    connectedReader,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    cancelPaymentIntent,
    cancelCollectPaymentMethod,
    cancelConfirmPaymentIntent,
    disconnectReader,
    supportsReadersOfType,
    isInitialized,
  } = terminal.useStripeTerminal({
    onDidRequestReaderInput: (options) => {
      const text = Array.isArray(options) ? options.join(', ') : String(options || '');
      if (text) setBusyStatus(text);
    },
    onDidRequestReaderDisplayMessage: (message) => setBusyStatus(String(message || 'Présente la carte.')),
  });

  const connectTapReader = useCallback(async (token) => {
    const config = await adminApi.terminalConfig(token);
    if (!config?.locationId) {
      throw new Error('STRIPE_TERMINAL_LOCATION_ID est manquant dans le backend.');
    }

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      throw new Error('Tap to Pay demande une build native Android ou iOS.');
    }

    await ensureTapToPayPermissions();

    const support = await supportsReadersOfType({
      deviceType: 'tapToPay',
      discoveryMethod: 'tapToPay',
      simulated: false,
    });
    if (support?.error) throw new Error(support.error.message);
    if (!support?.readerSupportResult) throw new Error(tapToPaySupportMessage(support));

    const result = await easyConnect(getTapToPayConnectParams(config));
    if (result?.error) throw new Error(result.error.message);
    return result.reader;
  }, [easyConnect, supportsReadersOfType]);

  const startPayment = useCallback(async (payload) => {
    const token = payload?.token || tokenRef.current;
    if (!token) throw new Error('Connexion admin requise avant Tap to Pay.');
    tokenRef.current = token;
    nativeTokenRef.current = token;

    setBusyStatus('Vérification Stripe Terminal...');
    const connectionToken = await adminApi.terminalConnectionToken(token);
    if (!connectionToken?.secret) throw new Error('Le backend n’a pas retourné de connection token Stripe Terminal.');
    nativeConnectionTokenRef.current = connectionToken.secret;

    if (!isInitialized) {
      const initResult = await initialize();
      if (initResult?.error) throw new Error(initResult.error.message);
    }

    setBusyStatus('Connexion Tap to Pay...');
    if (!connectedReader) await connectTapReader(token);

    let intent = null;
    let cancelRequested = false;
    try {
      setBusyStatus('Création de la transaction...');
      const isCart = payload.itemType === 'cart';
      const isYarn = payload.itemType === 'yarn';
      const isCustom = payload.itemType === 'custom';
      intent = isCart
        ? await adminApi.marketCartTapToPayIntent(token, {
            items: payload.items || [],
            customerName: payload.customerName || undefined,
            customerEmail: payload.customerEmail || undefined,
          })
        : isYarn
        ? await adminApi.yarnTapToPayIntent(token, payload.yarnId, {
            salePrice: payload.salePrice ?? undefined,
            customerName: payload.customerName || undefined,
            customerEmail: payload.customerEmail || undefined,
          })
        : isCustom
        ? await adminApi.customTapToPayIntent(token, payload.customOrderId, {
            amount: payload.amount,
            kind: payload.kind || 'BALANCE',
          })
        : await adminApi.tapToPayIntent(token, payload.productId, {
            productVariantId: payload.productVariantId || undefined,
            salePrice: payload.salePrice ?? undefined,
            customerName: payload.customerName || undefined,
            customerEmail: payload.customerEmail || undefined,
          });

      currentTapPaymentRef.current = {
        token,
        itemType: payload.itemType || 'product',
        paymentIntentId: intent.paymentIntentId,
        paymentIntent: null,
        stage: 'created',
        cancelRequested: false,
      };
      postWebViewEvent(webviewRef, 'itsgenygarts:tap-to-pay-started', {
        orderId: intent.orderId,
        customOrderId: intent.customOrderId,
        paymentIntentId: intent.paymentIntentId,
        itemType: payload.itemType || 'product',
      });

      setBusyStatus('Préparation du paiement...');
      const retrieved = await retrievePaymentIntent(intent.clientSecret);
      if (retrieved?.error) throw new Error(retrieved.error.message);
      currentTapPaymentRef.current = {
        ...currentTapPaymentRef.current,
        paymentIntent: retrieved.paymentIntent,
        stage: 'retrieved',
      };

      setBusyStatus('Présente la carte ou le téléphone du client.');
      currentTapPaymentRef.current = {
        ...currentTapPaymentRef.current,
        stage: 'collecting',
      };
      const collected = await collectPaymentMethod({ paymentIntent: retrieved.paymentIntent });
      if (collected?.error) throw new Error(collected.error.message);
      currentTapPaymentRef.current = {
        ...currentTapPaymentRef.current,
        paymentIntent: collected.paymentIntent,
        stage: 'collected',
      };

      setBusyStatus('Confirmation du paiement...');
      currentTapPaymentRef.current = {
        ...currentTapPaymentRef.current,
        stage: 'confirming',
      };
      const confirmed = await confirmPaymentIntent({ paymentIntent: collected.paymentIntent });
      if (confirmed?.error) throw new Error(confirmed.error.message);
      currentTapPaymentRef.current = {
        ...currentTapPaymentRef.current,
        paymentIntent: confirmed.paymentIntent,
        stage: 'confirmed',
      };

      setBusyStatus('Synchronisation de la commande...');
      const synced = isYarn
        ? await adminApi.syncYarnTapToPay(token, intent.paymentIntentId)
        : isCustom
        ? await adminApi.syncCustomTapToPay(token, intent.paymentIntentId)
        : await adminApi.syncTapToPay(token, intent.paymentIntentId);
      if (synced.status !== 'succeeded' && !synced.order) {
        throw new Error(`Paiement non finalisé: ${synced.status || 'statut inconnu'}`);
      }

      postWebViewEvent(webviewRef, 'itsgenygarts:tap-to-pay-result', {
        success: true,
        orderId: synced.order?.id,
        customOrderId: synced.order?.id || intent.customOrderId,
        paymentIntentId: intent.paymentIntentId,
        itemType: payload.itemType || 'product',
      });
      Alert.alert('Paiement réussi', synced.order?.id ? `Commande #${synced.order.id} payée.` : 'Paiement confirmé.');
      currentTapPaymentRef.current = null;
      webviewRef.current?.reload();
    } catch (err) {
      cancelRequested = !!currentTapPaymentRef.current?.cancelRequested;
      const userMessage = cancelRequested ? '' : normalizeTapToPayErrorMessage(err);
      if (intent?.paymentIntentId) {
        const isYarn = payload.itemType === 'yarn';
        const isCustom = payload.itemType === 'custom';
        const cancelPayment = isYarn
          ? adminApi.cancelYarnTapToPay
          : isCustom
          ? adminApi.cancelCustomTapToPay
          : adminApi.cancelTapToPay;
        await cancelPayment(token, intent.paymentIntentId).catch(() => {});
      }
      if (currentTapPaymentRef.current?.stage === 'collecting') {
        await cancelCollectPaymentMethod().catch(() => {});
      }
      if (currentTapPaymentRef.current?.stage === 'confirming') {
        await cancelConfirmPaymentIntent().catch(() => {});
      }
      if (connectedReader) {
        await disconnectReader().catch(() => {});
      }
      currentTapPaymentRef.current = null;
      postWebViewEvent(webviewRef, 'itsgenygarts:tap-to-pay-result', {
        success: false,
        ...(cancelRequested ? { cancelled: true } : { message: userMessage }),
        itemType: payload.itemType || 'product',
      });
      if (cancelRequested) return;
      throw new Error(userMessage);
    }
  }, [
    cancelCollectPaymentMethod,
    cancelConfirmPaymentIntent,
    cancelPaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    connectTapReader,
    connectedReader,
    disconnectReader,
    initialize,
    isInitialized,
    retrievePaymentIntent,
    setBusyStatus,
    tokenRef,
    webviewRef,
  ]);

  const cancelActivePayment = useCallback(async (payload = {}) => {
    const active = currentTapPaymentRef.current || {};
    const token = active.token || payload.token || tokenRef.current;
    const paymentIntentId = active.paymentIntentId || payload.paymentIntentId;
    const itemType = active.itemType || payload.itemType || 'product';

    currentTapPaymentRef.current = {
      ...active,
      token,
      paymentIntentId,
      itemType,
      cancelRequested: true,
    };
    setBusyStatus('');

    if (active.stage === 'collecting') {
      await cancelCollectPaymentMethod().catch(() => {});
    }
    if (active.stage === 'confirming') {
      await cancelConfirmPaymentIntent().catch(() => {});
    }
    if (active.paymentIntent) {
      await cancelPaymentIntent({ paymentIntent: active.paymentIntent }).catch(() => {});
    }
    if (token && paymentIntentId) {
      const cancelPayment = itemType === 'yarn'
        ? adminApi.cancelYarnTapToPay
        : itemType === 'custom'
        ? adminApi.cancelCustomTapToPay
        : adminApi.cancelTapToPay;
      await cancelPayment(token, paymentIntentId).catch(() => {});
    }

    postWebViewEvent(webviewRef, 'itsgenygarts:tap-to-pay-result', {
      success: false,
      cancelled: true,
      itemType,
    });
  }, [
    cancelCollectPaymentMethod,
    cancelConfirmPaymentIntent,
    cancelPaymentIntent,
    setBusyStatus,
    tokenRef,
    webviewRef,
  ]);

  useEffect(() => {
    terminalBridgeRef.current = startPayment;
    terminalCancelRef.current = cancelActivePayment;
  }, [cancelActivePayment, startPayment]);

  return null;
}

const terminalBridgeRef = { current: null };
const terminalCancelRef = { current: null };
const currentTapPaymentRef = { current: null };
const nativeConnectionTokenRef = { current: null };

function AppShell({ terminal }) {
  const webviewRef = useRef(null);
  const tokenRef = useRef(null);
  const pushTokenRef = useRef(null);
  const pushRegistrationRef = useRef(null);
  const [error, setError] = useState(null);
  const [busyStatus, setBusyStatus] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const targetUrl = `${ADMIN_URL}?mobileApp=1`;

  const ensurePushRegistered = useCallback(async (token) => {
    if (!token || pushRegistrationRef.current === token) return;
    pushRegistrationRef.current = token;
    try {
      const hasShownSuccessNotice = await SecureStore.getItemAsync(PUSH_SUCCESS_NOTICE_STORAGE_KEY) === '1';
      if (!hasShownSuccessNotice) setPushStatus('Activation des notifications...');

      const pushToken = await registerForPushNotifications(token);
      pushTokenRef.current = pushToken;

      if (pushToken) {
        await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, pushToken);
      }

      if (!hasShownSuccessNotice) {
        setPushStatus('Notifications activées.');
        await SecureStore.setItemAsync(PUSH_SUCCESS_NOTICE_STORAGE_KEY, '1');
        setTimeout(() => setPushStatus(''), 4000);
      } else {
        setPushStatus('');
      }
    } catch (err) {
      const message = pushErrorMessage(err);
      console.warn('Push notification registration failed:', message);
      setPushStatus(message);
      Alert.alert('Notifications push', message);
      pushRegistrationRef.current = null;
    }
  }, []);

  const handleMessage = useCallback(async (event) => {
    if (!isTrustedAdminUrl(event.nativeEvent.url)) {
      console.warn('Ignored WebView message from an untrusted origin.');
      return;
    }

    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message?.type === 'ADMIN_AUTH_TOKEN') {
      const token = message.token || null;
      tokenRef.current = token;
      nativeTokenRef.current = token;
      await ensurePushRegistered(token);
      return;
    }

    if (message?.type === 'CANCEL_TAP_TO_PAY') {
      if (terminalCancelRef.current) {
        await terminalCancelRef.current(message.payload || {});
      }
      setBusyStatus('');
      return;
    }

    if (message?.type !== 'START_TAP_TO_PAY') return;

    if (!terminal || !terminalBridgeRef.current) {
      const text = 'Le SDK Stripe Terminal natif n’est pas disponible dans cette build.';
      postWebViewEvent(webviewRef, 'itsgenygarts:tap-to-pay-result', { success: false, message: text });
      Alert.alert('Tap to Pay indisponible', text);
      return;
    }

    try {
      setBusyStatus('Démarrage Tap to Pay...');
      await terminalBridgeRef.current(message.payload || {});
    } catch (err) {
      Alert.alert('Tap to Pay échoué', err.message);
    } finally {
      setBusyStatus('');
    }
  }, [ensurePushRegistered, terminal]);

  const handleNavigationRequest = useCallback((request) => {
    const requestedUrl = request?.url || '';
    if (isTrustedAdminUrl(requestedUrl)) return true;

    if (/^(?:https?|mailto|tel):/i.test(requestedUrl)) {
      Linking.openURL(requestedUrl).catch(() => {});
    }
    return false;
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateWebView(webviewRef, getNotificationPath(response));
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => navigateWebView(webviewRef, getNotificationPath(response)))
      .catch(() => {});

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Impossible d'ouvrir l'admin</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorUrl}>{targetUrl}</Text>
          <Text style={styles.errorHint}>
            Vérifie ta connexion internet, puis réessaie. Si le serveur est hors ligne, l'admin se rouvrira dès qu'il répondra.
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setReloadKey((current) => current + 1);
            }}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.webviewWrap}>
          <WebView
            key={reloadKey}
            ref={webviewRef}
            source={{ uri: targetUrl }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            bounces
            setSupportMultipleWindows={false}
            originWhitelist={ADMIN_ORIGIN ? [ADMIN_ORIGIN, `${ADMIN_ORIGIN}/*`] : []}
            injectedJavaScript={webViewBootstrapScript}
            injectedJavaScriptBeforeContentLoaded={webViewBootstrapScript}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleNavigationRequest}
            onLoadStart={() => setError(null)}
            onError={(event) => {
              setError(event.nativeEvent.description || 'Serveur admin inaccessible.');
            }}
          />
          {busyStatus ? (
            <View style={styles.paymentOverlay} pointerEvents="none">
              <Text style={styles.paymentTitle}>Tap to Pay</Text>
              <Text style={styles.paymentText}>{busyStatus}</Text>
            </View>
          ) : null}
          {pushStatus ? (
            <View style={styles.pushOverlay} pointerEvents="none">
              <Text style={styles.pushText}>{pushStatus}</Text>
            </View>
          ) : null}
        </View>
      )}
      {terminal ? (
        <TapToPayBridge terminal={terminal} webviewRef={webviewRef} tokenRef={tokenRef} setBusyStatus={setBusyStatus} />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  const TerminalProvider = terminalModule?.StripeTerminalProvider;
  const tokenProvider = useCallback(async () => {
    if (nativeConnectionTokenRef.current) {
      const secret = nativeConnectionTokenRef.current;
      nativeConnectionTokenRef.current = null;
      return secret;
    }

    const token = nativeTokenRef.current;
    if (!token) throw new Error('Connexion admin requise.');
    const data = await adminApi.terminalConnectionToken(token);
    return data.secret;
  }, []);

  if (!TerminalProvider) return <AppShell terminal={null} />;

  return (
    <TerminalProvider tokenProvider={tokenProvider} logLevel="verbose">
      <AppShell terminal={terminalModule} />
    </TerminalProvider>
  );
}

const nativeTokenRef = { current: null };

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingTop: APP_TOP_INSET,
    paddingBottom: APP_BOTTOM_INSET,
    backgroundColor: '#F7F2EF',
  },
  webviewWrap: { flex: 1 },
  errorState: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F7F2EF',
  },
  errorTitle: { color: '#241C1B', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorText: { color: '#746967', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  errorUrl: {
    color: '#DD7A8F',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
  errorHint: { color: '#746967', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: {
    minWidth: 150,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 18,
    backgroundColor: '#DD7A8F',
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  paymentOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#241C1B',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  paymentTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  paymentText: { color: '#F7F2EF', fontSize: 14, lineHeight: 20 },
  pushOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 12,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#DD7A8F',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  pushText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 18, textAlign: 'center' },
});
