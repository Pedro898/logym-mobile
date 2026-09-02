import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

// ================================================================
// LAYOUT PRINCIPAL
//
// No Expo Web, Web e Mobile não podem compartilhar o mesmo JSESSIONID
// do Spring. Em desenvolvimento, se o Mobile for aberto em localhost,
// redirecionamos automaticamente para 127.0.0.1 mantendo a mesma porta
// e rota. Assim:
//
// Web:        localhost -> backend localhost:8080
// Mobile Web: 127.0.0.1 -> backend 127.0.0.1:8080
//
// Os cookies ficam separados e uma conta não troca a sessão da outra.
// ================================================================

export default function RootLayout() {
  const [hostPreparado, setHostPreparado] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    if (typeof window === 'undefined') {
      setHostPreparado(true);
      return;
    }

    if (window.location.hostname === 'localhost') {
      const novaUrl = new URL(window.location.href);
      novaUrl.hostname = '127.0.0.1';
      window.location.replace(novaUrl.toString());
      return;
    }

    setHostPreparado(true);
  }, []);

  if (!hostPreparado) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#000',
          },
        }}
      />
    </>
  );
}
