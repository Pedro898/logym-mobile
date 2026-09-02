import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';

import {
  buscarUsuarioAutenticado,
  formatarNomeUsuario,
  type Usuario,
} from '@/lib/api';
import {
  ehAdmin,
  ehAdministrativo,
  ehGerente,
} from '@/lib/permissoes';

// ================================================================
// URL DO FRONTEND WEB
//
// EXPO_PUBLIC_WEB_URL pode ser usado para produção ou para definir
// uma URL manualmente.
//
// Desenvolvimento no PC:
// Web normal   -> http://localhost:5173
// Mobile Web   -> http://127.0.0.1:<porta do Expo>
//
// Abrimos localhost:5173 de propósito para manter a sessão Web
// separada da sessão do Mobile Web (127.0.0.1).
// ================================================================

function buscarWebUrl() {
  if (process.env.EXPO_PUBLIC_WEB_URL) {
    return process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5173';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  const host = hostUri?.split(':')[0];

  // Expo Go em celular físico: usa o IP do computador na rede local.
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:5173`;
  }

  // Android Emulator acessa o localhost do computador por 10.0.2.2.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5173';
  }

  return 'http://localhost:5173';
}

export default function Painel() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abrindoWeb, setAbrindoWeb] = useState(false);

  // ==============================================================
  // SESSÃO REAL
  //
  // Não usamos o AsyncStorage para decidir o nível de acesso.
  // Primeiro perguntamos ao Spring quem está autenticado por /me e
  // só depois atualizamos a cópia local.
  // ============================================================== 

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarUsuario() {
        try {
          setCarregando(true);

          const usuarioLogado = await buscarUsuarioAutenticado();

          if (!ativo) {
            return;
          }

          await AsyncStorage.setItem(
            'usuario',
            JSON.stringify(usuarioLogado)
          );

          // Somente MANAGER/ADMIN possuem o painel administrativo.
          if (!ehAdministrativo(usuarioLogado)) {
            setUsuario(usuarioLogado);
            router.replace('/academias');
            return;
          }

          setUsuario(usuarioLogado);
        } catch (error) {
          console.error('Erro ao carregar painel:', error);

          await AsyncStorage.removeItem('usuario');

          if (ativo) {
            setUsuario(null);
            router.replace('/login');
          }
        } finally {
          if (ativo) {
            setCarregando(false);
          }
        }
      }

      carregarUsuario();

      return () => {
        ativo = false;
      };
    }, [router])
  );

  // ==============================================================
  // ABRIR PAINEL WEB
  // ============================================================== 

  async function abrirPainelWeb() {
    if (!usuario || !ehAdministrativo(usuario)) {
      return;
    }

    const rotaWeb = ehAdmin(usuario)
      ? '/painel-admin'
      : '/painel-gerente';

    const url = `${buscarWebUrl()}${rotaWeb}`;

    try {
      setAbrindoWeb(true);

      const podeAbrir = await Linking.canOpenURL(url);

      if (!podeAbrir) {
        Alert.alert(
          'Não foi possível abrir o painel',
          `Confira se o Frontend Web do LOGYM está rodando em ${buscarWebUrl()}.`
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Erro ao abrir painel Web:', error);

      Alert.alert(
        'Erro',
        'Não foi possível abrir o painel Web. Verifique se o Frontend Web está iniciado.'
      );
    } finally {
      setAbrindoWeb(false);
    }
  }

  if (carregando || !usuario) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#f97316" />

        <Text
          style={{
            color: '#ccc',
            marginTop: 12,
            fontSize: 15,
          }}
        >
          Carregando painel...
        </Text>
      </View>
    );
  }

  const usuarioEhAdmin = ehAdmin(usuario);
  const usuarioEhGerente = ehGerente(usuario);
  const nomeUsuario = formatarNomeUsuario(usuario);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 55,
          paddingHorizontal: 20,
          paddingBottom: 125,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            IDENTIFICAÇÃO
        ======================================================== */}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 28,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#111',
              borderWidth: 1,
              borderColor: '#f97316',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 13,
            }}
          >
            <Ionicons
              name={
                usuarioEhAdmin
                  ? 'shield-checkmark-outline'
                  : 'briefcase-outline'
              }
              size={27}
              color="#f97316"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#888',
                fontSize: 13,
                marginBottom: 3,
              }}
            >
              {usuarioEhAdmin ? 'Administrador' : 'Gerente'}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: 'bold',
              }}
            >
              {nomeUsuario}
            </Text>
          </View>
        </View>

        {/* ========================================================
            TÍTULO
        ======================================================== */}

        <Text
          style={{
            color: '#fff',
            fontSize: 29,
            fontWeight: '900',
            marginBottom: 9,
          }}
        >
          {usuarioEhAdmin
            ? 'Painel do Administrador'
            : 'Painel do Gerente'}
        </Text>

        <Text
          style={{
            color: '#aaa',
            fontSize: 15,
            lineHeight: 22,
            marginBottom: 26,
          }}
        >
          No aplicativo você pode consultar o LOGYM. As ferramentas de
          administração e edição continuam concentradas no sistema Web.
        </Text>

        {/* ========================================================
            O QUE PODE FAZER NO MOBILE
        ======================================================== */}

        <View
          style={{
            backgroundColor: '#0a0a0a',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#222',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 13,
            }}
          >
            <Ionicons name="phone-portrait-outline" size={23} color="#f97316" />

            <Text
              style={{
                color: '#fff',
                fontSize: 17,
                fontWeight: 'bold',
                marginLeft: 10,
              }}
            >
              No Mobile
            </Text>
          </View>

          <Text
            style={{
              color: '#ccc',
              fontSize: 15,
              lineHeight: 24,
            }}
          >
            • Visualizar academias{`\n`}
            • Visualizar fotos e informações{`\n`}
            • Consultar notas e avaliações{`\n`}
            • Acessar e atualizar o perfil
          </Text>
        </View>

        {/* ========================================================
            O QUE FICA NO WEB
        ======================================================== */}

        <View
          style={{
            backgroundColor: '#0a0a0a',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#222',
            padding: 18,
            marginBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 13,
            }}
          >
            <Ionicons name="desktop-outline" size={23} color="#f97316" />

            <Text
              style={{
                color: '#fff',
                fontSize: 17,
                fontWeight: 'bold',
                marginLeft: 10,
              }}
            >
              No painel Web
            </Text>
          </View>

          {usuarioEhGerente ? (
            <Text
              style={{
                color: '#ccc',
                fontSize: 15,
                lineHeight: 24,
              }}
            >
              • Cadastrar e gerenciar academias{`\n`}
              • Editar informações da academia{`\n`}
              • Gerenciar fotos{`\n`}
              • Acessar as ferramentas do gerente
            </Text>
          ) : (
            <Text
              style={{
                color: '#ccc',
                fontSize: 15,
                lineHeight: 24,
              }}
            >
              • Administrar usuários e academias{`\n`}
              • Gerenciar categorias e facilidades{`\n`}
              • Administrar avaliações{`\n`}
              • Acessar as ferramentas administrativas
            </Text>
          )}
        </View>

        {/* ========================================================
            BOTÃO WEB
        ======================================================== */}

        <TouchableOpacity
          onPress={abrirPainelWeb}
          disabled={abrindoWeb}
          activeOpacity={0.85}
          style={{
            backgroundColor: abrindoWeb ? '#9a4d12' : '#f97316',
            borderRadius: 16,
            minHeight: 54,
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {abrindoWeb ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="open-outline" size={22} color="#fff" />

              <Text
                style={{
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 'bold',
                  marginLeft: 8,
                }}
              >
                Abrir painel Web
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text
          style={{
            color: '#777',
            fontSize: 12,
            lineHeight: 18,
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          Se o Web pedir autenticação, entre com a conta correspondente ao seu
          perfil de {usuarioEhAdmin ? 'administrador' : 'gerente'}.
        </Text>
      </ScrollView>

      <BottomTabBar usuario={usuario} />
    </View>
  );
}
