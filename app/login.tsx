import {
  buscarUsuarioAutenticado,
  login,
  verificarStatusLogin,
  type Usuario,
} from '@/lib/api';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants from 'expo-constants';

import { useRouter } from 'expo-router';

import { useState } from 'react';

import {
  Image,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ================================================================
// LOGIN
// ================================================================

export default function Login() {
  const router =
    useRouter();

  // ==============================================================
  // ESTADOS
  // ==============================================================

  const [
    username,
    setUsername,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState('');

  // ==============================================================
  // URL DA WEB
  //
  // Usada somente para:
  //
  // - Cadastro
  // - Esqueci minha senha
  // ==============================================================

  function buscarWebUrl() {
    if (
      process.env
        .EXPO_PUBLIC_WEB_URL
    ) {
      return process.env
        .EXPO_PUBLIC_WEB_URL
        .replace(
          /\/$/,
          ''
        );
    }

    // Expo Web.
    if (
      Platform.OS ===
      'web'
    ) {
      return 'http://localhost:5173';
    }

    // Dispositivo físico.
    const hostUri =
      Constants.expoConfig
        ?.hostUri ||
      (Constants as any)
        .manifest
        ?.debuggerHost ||
      (Constants as any)
        .manifest2
        ?.extra
        ?.expoClient
        ?.hostUri;

    const host =
      hostUri?.split(
        ':'
      )[0];

    if (
      host &&
      host !==
        'localhost' &&
      host !==
        '127.0.0.1'
    ) {
      return `http://${host}:5173`;
    }

    return 'http://localhost:5173';
  }

  const WEB_URL =
    buscarWebUrl();

  // ==============================================================
  // ABRE LOGIN WEB COM REDIRECT
  // ==============================================================

  function abrirWebLoginComRedirect(
    redirect: string
  ) {
    const redirectFormatado =
      encodeURIComponent(
        redirect
      );

    Linking.openURL(
      `${WEB_URL}/login?redirect=${redirectFormatado}`
    );
  }

  // ==============================================================
  // CADASTRO WEB
  // ==============================================================

  function abrirCadastroWeb() {
    Linking.openURL(
      `${WEB_URL}/cadastrar`
    );
  }

  // ==============================================================
  // MENSAGEM DE ERRO
  // ==============================================================

  function tratarErroLogin(
    error: unknown
  ) {
    if (
      !(error instanceof Error)
    ) {
      return 'Não foi possível realizar o login.';
    }

    const mensagem =
      error.message || '';

    const mensagemMinuscula =
      mensagem.toLowerCase();

    // ============================================================
    // PROBLEMA DE CONEXÃO
    // ============================================================

    if (
      mensagem.includes(
        'Failed to fetch'
      ) ||
      mensagem.includes(
        'Network request failed'
      ) ||
      mensagem.includes(
        'Tempo esgotado'
      )
    ) {
      return 'Não foi possível conectar ao backend. Confira se o servidor está rodando e se o celular está na mesma rede.';
    }

    // ============================================================
    // CONTA SUSPENSA
    // ============================================================

    if (
      mensagemMinuscula.includes(
        'suspens'
      )
    ) {
      return 'Sua conta foi suspensa pelo administrador. Entre em contato com o suporte.';
    }

    // ============================================================
    // CONTA INATIVA
    // ============================================================

    if (
      mensagemMinuscula.includes(
        'inativ'
      )
    ) {
      return 'Sua conta está inativa. Entre em contato com o suporte.';
    }

    // ============================================================
    // CREDENCIAIS
    // ============================================================

    if (
      mensagemMinuscula.includes(
        'senha'
      ) ||
      mensagemMinuscula.includes(
        'e-mail'
      ) ||
      mensagemMinuscula.includes(
        'email'
      ) ||
      mensagemMinuscula.includes(
        'credenciais'
      )
    ) {
      return mensagem;
    }

    return (
      mensagem ||
      'Erro ao fazer login. Verifique suas credenciais.'
    );
  }

  // ==============================================================
  // ENTRAR
  // ==============================================================

  async function entrar() {
    setErro('');

    // ============================================================
    // VALIDAÇÃO
    // ============================================================

    if (
      !username.trim()
    ) {
      setErro(
        'Digite seu e-mail.'
      );

      return;
    }

    if (!password) {
      setErro(
        'Digite sua senha.'
      );

      return;
    }

    if (
      password.length < 6
    ) {
      setErro(
        'A senha deve ter pelo menos 6 caracteres.'
      );

      return;
    }

    try {
      setCarregando(
        true
      );

      // ==========================================================
      // PASSO 1
      //
      // Mesma verificação feita pelo Web.
      //
      // Antes do login, verificamos se a conta:
      //
      // ATIVO
      // INATIVO
      // SUSPENSO
      // ==========================================================

      const statusLogin =
        await verificarStatusLogin(
          username
        );

      if (
        statusLogin
          ?.podeLogar ===
        false
      ) {
        setErro(
          statusLogin
            .message ||
            'Esta conta não pode acessar o sistema.'
        );

        return;
      }

      // ==========================================================
      // PASSO 2
      //
      // Login REAL do Spring Security.
      //
      // POST /login
      //
      // Esta chamada cria a sessão do usuário.
      // ==========================================================

      await login(
        username,
        password
      );

      // ==========================================================
      // PASSO 3
      //
      // Busca o usuário da sessão.
      //
      // GET /usuarios/me
      //
      // Se esta chamada funcionar, temos a confirmação de que
      // o backend reconhece o Mobile como autenticado.
      // ==========================================================

      const usuarioBackend =
        await buscarUsuarioAutenticado();

      // ==========================================================
      // SEGURANÇA EXTRA
      //
      // Não salvamos usuário fake/local.
      //
      // O usuário necessariamente precisa ter vindo do backend.
      // ==========================================================

      if (
        !usuarioBackend ||
        !usuarioBackend.id
      ) {
        throw new Error(
          'O backend não retornou os dados do usuário autenticado.'
        );
      }

      // ==========================================================
      // USUÁRIO QUE SERÁ SALVO LOCALMENTE
      // ==========================================================

      const usuarioParaSalvar: Usuario =
        {
          id:
            usuarioBackend.id,

          nome:
            usuarioBackend.nome ||
            usuarioBackend.username ||
            username.trim(),

          username:
            usuarioBackend.username ||
            username
              .trim()
              .toLowerCase(),

          nivelAcesso:
            usuarioBackend.nivelAcesso,

          statusUsuario:
            usuarioBackend.statusUsuario,

          cep:
            usuarioBackend.cep ||
            '',
        };

      // ==========================================================
      // SALVA NO ASYNC STORAGE
      //
      // AsyncStorage não é a autenticação.
      //
      // Ele serve apenas para o Mobile lembrar quem é o usuário.
      //
      // A autenticação verdadeira está na sessão do backend.
      // ==========================================================

      await AsyncStorage.setItem(
        'usuario',
        JSON.stringify(
          usuarioParaSalvar
        )
      );

      // ==========================================================
      // REDIRECIONAMENTO
      // ==========================================================

      router.replace(
        '/academias'
      );
    } catch (error) {
      console.error(
        'Erro no login:',
        error
      );

      setErro(
        tratarErroLogin(
          error
        )
      );
    } finally {
      setCarregando(
        false
      );
    }
  }

  // ==============================================================
  // INTERFACE
  // ==============================================================

  return (
    <View
      style={{
        flex: 1,

        backgroundColor:
          '#000000',

        justifyContent:
          'center',

        padding: 25,
      }}
    >
      {/* ==========================================================
          LOGO
      ========================================================== */}

      <Image
        source={require('../assets/images/logoSimples.png')}
        style={{
          width: 170,

          height: 170,

          alignSelf:
            'center',

          marginBottom:
            -30,
        }}
        resizeMode="contain"
      />

      {/* ==========================================================
          FORMULÁRIO
      ========================================================== */}

      <View
        style={{
          backgroundColor:
            '#000000',

          padding: 20,

          borderRadius: 25,

          shadowColor:
            '#000',

          shadowOpacity:
            0.3,

          shadowRadius:
            10,
        }}
      >
        {/* ========================================================
            E-MAIL
        ======================================================== */}

        <Text
          style={{
            color:
              '#ffffff',

            marginBottom:
              5,
          }}
        >
          E-mail
        </Text>

        <TextInput
          placeholder="Digite seu e-mail"
          placeholderTextColor="#ffffff"
          value={username}
          onChangeText={(
            texto
          ) => {
            setUsername(
              texto
            );

            // Remove a mensagem enquanto o usuário corrige.
            if (erro) {
              setErro('');
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={{
            backgroundColor:
              '#8b8a8a',

            color: '#fff',

            padding: 15,

            borderRadius: 12,

            marginBottom:
              15,
          }}
        />

        {/* ========================================================
            SENHA
        ======================================================== */}

        <Text
          style={{
            color:
              '#ffffff',

            marginBottom:
              5,
          }}
        >
          Senha
        </Text>

        <TextInput
          placeholder="Digite sua senha"
          placeholderTextColor="#ffffff"
          secureTextEntry
          value={password}
          onChangeText={(
            texto
          ) => {
            setPassword(
              texto
            );

            if (erro) {
              setErro('');
            }
          }}
          style={{
            backgroundColor:
              '#8b8a8a',

            color: '#fff',

            padding: 15,

            borderRadius: 12,

            marginBottom:
              10,
          }}
        />

        {/* ========================================================
            ERRO
        ======================================================== */}

        {erro ? (
          <Text
            style={{
              color:
                '#ffb4b4',

              marginBottom:
                12,

              lineHeight: 20,
            }}
          >
            {erro}
          </Text>
        ) : null}

        {/* ========================================================
            ESQUECEU A SENHA
        ======================================================== */}

        <Text
          onPress={() =>
            abrirWebLoginComRedirect(
              '/esqueci-minha-senha'
            )
          }
          style={{
            color:
              '#f97316',

            textAlign:
              'right',

            marginBottom:
              16,

            fontWeight:
              'bold',
          }}
        >
          Esqueceu a senha?
        </Text>

        {/* ========================================================
            BOTÃO ENTRAR
        ======================================================== */}

        <TouchableOpacity
          onPress={entrar}
          disabled={
            carregando
          }
          style={{
            backgroundColor:
              carregando
                ? '#9a4d12'
                : '#f97316',

            padding: 18,

            borderRadius: 15,

            alignItems:
              'center',

            shadowColor:
              '#f97316',

            shadowOpacity:
              0.6,

            shadowRadius:
              10,

            marginBottom:
              12,

            opacity:
              carregando
                ? 0.8
                : 1,
          }}
        >
          <Text
            style={{
              color: '#fff',

              fontWeight:
                'bold',

              fontSize: 16,
            }}
          >
            {carregando
              ? 'Entrando...'
              : 'Entrar'}
          </Text>
        </TouchableOpacity>

        {/* ========================================================
            CADASTRO
        ======================================================== */}

        <Text
          style={{
            color: '#fff',

            marginTop: 8,

            textAlign:
              'center',
          }}
        >
          Ainda não possui uma conta?{' '}

          <Text
            onPress={
              abrirCadastroWeb
            }
            style={{
              color:
                '#f97316',

              fontWeight:
                'bold',

              textDecorationLine:
                'underline',
            }}
          >
            Cadastre-se
          </Text>
        </Text>
      </View>
    </View>
  );
}