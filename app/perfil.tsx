import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import UserAvatarPlaceholder from '../components/UserAvatarPlaceholder';

import {
  atualizarFotoPerfil,
  atualizarNomeECepUsuario,
  buscarEnderecoPorCep,
  buscarUsuarioAutenticado,
  formatarCep,
  formatarNomeUsuario,
  getFotoUsuarioUrl,
  limparCep,
  logout,
  type Usuario,
} from '@/lib/api';

export default function Perfil() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [nome, setNome] = useState('');
  const [cep, setCep] = useState('');

  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const [cepValido, setCepValido] = useState(false);
  const [editando, setEditando] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [mensagem, setMensagem] = useState('');

  const [fotoVersao, setFotoVersao] = useState(Date.now());

  // Quando a foto não existe no banco, a URL ainda é criada por causa do usuario.id.
  // Então usamos esse controle para trocar para o bonequinho quando a imagem falhar.
  const [fotoPerfilErro, setFotoPerfilErro] = useState(false);

  const nomeUsuario = formatarNomeUsuario(usuario);

  const ehUsuarioComum =
    usuario?.nivelAcesso === 'USER' || !usuario?.nivelAcesso;

  const deveMostrarCamposEndereco =
    ehUsuarioComum &&
    limparCep(cep).length === 8 &&
    (cepValido || !!endereco || !!bairro || !!cidade || !!estado || buscandoCep);

  const fotoUrlBase = getFotoUsuarioUrl(usuario?.id);
  const fotoUrl = fotoUrlBase ? `${fotoUrlBase}?mobile=${fotoVersao}` : null;
  const deveMostrarFotoPerfil = fotoUrl && !fotoPerfilErro;

  function limparEnderecoViaCep() {
    setEndereco('');
    setBairro('');
    setCidade('');
    setEstado('');
    setCepValido(false);
  }

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

    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:5173`;
    }

    return 'http://localhost:5173';
  }

  function abrirAlterarSenhaWeb() {
    const webUrl = buscarWebUrl();
    const redirectFormatado = encodeURIComponent('/profile');

    Linking.openURL(`${webUrl}/login?redirect=${redirectFormatado}`);
  }

  async function carregarEnderecoPeloCep(
    cepInformado: string,
    mostrarMensagem = true
  ) {
    const cepLimpo = limparCep(cepInformado);

    if (cepLimpo.length !== 8) {
      limparEnderecoViaCep();
      return false;
    }

    try {
      setBuscandoCep(true);

      const enderecoEncontrado = await buscarEnderecoPorCep(cepLimpo);

      setEndereco(enderecoEncontrado.endereco);
      setBairro(enderecoEncontrado.bairro);
      setCidade(enderecoEncontrado.cidade);
      setEstado(enderecoEncontrado.estado);
      setCep(formatarCep(enderecoEncontrado.cep));
      setCepValido(true);

      if (mostrarMensagem) {
        setMensagem('Endereço encontrado pelo CEP.');
      }

      return true;
    } catch (error) {
      console.error(error);

      limparEnderecoViaCep();

      if (mostrarMensagem) {
        if (error instanceof Error) {
          setMensagem(error.message);
        } else {
          setMensagem('CEP inválido ou não encontrado.');
        }
      }

      return false;
    } finally {
      setBuscandoCep(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      async function carregarUsuario() {
        setMensagem('');

        try {
          setCarregando(true);

          // A sessão do Spring é a fonte verdadeira da identidade.
          const usuarioBanco = await buscarUsuarioAutenticado();

          await AsyncStorage.setItem('usuario', JSON.stringify(usuarioBanco));

          setUsuario(usuarioBanco);
          setNome(usuarioBanco.nome || '');
          setCep(formatarCep(usuarioBanco.cep || ''));

          if (
            (usuarioBanco.nivelAcesso === 'USER' ||
              !usuarioBanco.nivelAcesso) &&
            usuarioBanco.cep
          ) {
            await carregarEnderecoPeloCep(usuarioBanco.cep, false);
          } else {
            limparEnderecoViaCep();
          }

          setFotoVersao(Date.now());
          setFotoPerfilErro(false);
        } catch (error) {
          console.error('Sessão inválida ou expirada:', error);

          await AsyncStorage.removeItem('usuario');
          setUsuario(null);
          setNome('');
          setCep('');
          limparEnderecoViaCep();
          setFotoPerfilErro(true);
          router.replace('/login');
        } finally {
          setCarregando(false);
        }
      }

      carregarUsuario();
    }, [])
  );

  async function alterarCep(valor: string) {
    setMensagem('');

    const cepFormatado = formatarCep(valor);
    const cepLimpo = limparCep(cepFormatado);

    setCep(cepFormatado);

    if (cepLimpo.length < 8) {
      limparEnderecoViaCep();
      return;
    }

    if (cepLimpo.length === 8) {
      await carregarEnderecoPeloCep(cepLimpo, true);
    }
  }

  async function escolherFotoPerfil() {
    setMensagem('');

    if (!usuario?.id) {
      setMensagem('Usuário não encontrado. Faça login novamente.');
      return;
    }

    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      setMensagem('Permissão negada para acessar suas fotos.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (resultado.canceled) {
      return;
    }

    const imagem = resultado.assets[0];

    if (!imagem?.uri) {
      setMensagem('Não foi possível carregar a imagem selecionada.');
      return;
    }

    try {
      setSalvandoFoto(true);

      await atualizarFotoPerfil(
        usuario.id,
        imagem.uri,
        imagem.mimeType || 'image/jpeg'
      );

      setFotoVersao(Date.now());
      setFotoPerfilErro(false);

      const usuarioAtualizado = await buscarUsuarioAutenticado();

      await AsyncStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));

      setUsuario(usuarioAtualizado);
      setMensagem('Foto de perfil atualizada!');
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setMensagem(error.message);
      } else {
        setMensagem('Erro ao atualizar foto de perfil.');
      }
    } finally {
      setSalvandoFoto(false);
    }
  }

  async function salvarPerfil() {
    setMensagem('');

    if (!usuario?.id) {
      setMensagem('Usuário não encontrado. Faça login novamente.');
      return;
    }

    if (!nome.trim()) {
      setMensagem('Informe o nome do usuário.');
      return;
    }

    let cepParaSalvar = usuario.cep || '';

    if (ehUsuarioComum) {
      const cepLimpo = limparCep(cep);

      if (cepLimpo.length !== 8) {
        setMensagem('O CEP precisa ter 8 números.');
        return;
      }

      try {
        setBuscandoCep(true);

        const enderecoEncontrado = await buscarEnderecoPorCep(cepLimpo);

        setEndereco(enderecoEncontrado.endereco);
        setBairro(enderecoEncontrado.bairro);
        setCidade(enderecoEncontrado.cidade);
        setEstado(enderecoEncontrado.estado);
        setCep(formatarCep(enderecoEncontrado.cep));
        setCepValido(true);

        cepParaSalvar = cepLimpo;
      } catch (error) {
        console.error(error);

        limparEnderecoViaCep();

        if (error instanceof Error) {
          setMensagem(error.message);
        } else {
          setMensagem('CEP inválido ou não encontrado.');
        }

        return;
      } finally {
        setBuscandoCep(false);
      }
    }

    try {
      setSalvando(true);

      const usuarioAtualizado = await atualizarNomeECepUsuario(
        usuario.id,
        nome,
        cepParaSalvar
      );

      await AsyncStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));

      setUsuario(usuarioAtualizado);
      setNome(usuarioAtualizado.nome || '');
      setCep(formatarCep(usuarioAtualizado.cep || ''));

      if (
        (usuarioAtualizado.nivelAcesso === 'USER' ||
          !usuarioAtualizado.nivelAcesso) &&
        usuarioAtualizado.cep
      ) {
        await carregarEnderecoPeloCep(usuarioAtualizado.cep, false);
      } else {
        limparEnderecoViaCep();
      }

      setEditando(false);
      setMensagem('Perfil atualizado!');
    } catch (error) {
      console.error(error);
      setMensagem('Erro ao atualizar nome e CEP no banco.');
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    try {
      // Encerra também a sessão real do Spring Security.
      await logout();
    } catch (error) {
      console.error('Erro ao encerrar sessão no backend:', error);
    } finally {
      await AsyncStorage.removeItem('usuario');
      router.replace('/login');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#000' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#000' }}
        contentContainerStyle={{
          paddingTop: 60,
          paddingHorizontal: 25,
          paddingBottom: 130,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.replace('/academias')}
          style={{ marginBottom: 20 }}
        >
          <Ionicons name="arrow-back-outline" size={38} color="#f97316" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 25 }}>
          {deveMostrarFotoPerfil ? (
            <Image
              source={{ uri: fotoUrl }}
              onError={() => setFotoPerfilErro(true)}
              style={{
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: '#222',
                borderWidth: 2,
                borderColor: '#f97316',
              }}
            />
          ) : (
            <UserAvatarPlaceholder size={130} />
          )}

          <TouchableOpacity
            onPress={escolherFotoPerfil}
            disabled={salvandoFoto}
            style={{
              backgroundColor: salvandoFoto ? '#9a4d12' : '#f97316',
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 14,
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {salvandoFoto ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={20} color="#fff" />

                <Text
                  style={{
                    color: '#fff',
                    fontWeight: 'bold',
                    marginLeft: 8,
                  }}
                >
                  Alterar foto
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: 'bold',
              marginTop: 10,
              textAlign: 'center',
            }}
          >
            {nomeUsuario}
          </Text>
        </View>

        <Text
          style={{
            color: '#f97316',
            fontSize: 26,
            fontWeight: 'bold',
            marginBottom: 22,
            alignSelf: 'center',
          }}
        >
          Seus dados pessoais
        </Text>

        {carregando ? (
          <View style={{ marginBottom: 15 }}>
            <ActivityIndicator color="#f97316" />

            <Text
              style={{
                color: '#ccc',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              Buscando dados do banco...
            </Text>
          </View>
        ) : null}

        {mensagem ? (
          <Text
            style={{
              color:
                mensagem.includes('atualizada') ||
                mensagem.includes('atualizado') ||
                mensagem.includes('Endereço encontrado')
                  ? '#86efac'
                  : '#ffb4b4',
              marginBottom: 15,
              textAlign: 'center',
            }}
          >
            {mensagem}
          </Text>
        ) : null}

        <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
          Nome
        </Text>

        <TextInput
          value={nome}
          onChangeText={setNome}
          editable={editando}
          placeholder="Digite seu nome"
          placeholderTextColor="#777"
          style={{
            backgroundColor: '#1a1a1a',
            color: '#fff',
            padding: 18,
            borderRadius: 18,
            fontSize: 18,
            marginBottom: 22,
            borderWidth: 1,
            borderColor: '#f97316',
            opacity: editando ? 1 : 0.7,
          }}
        />

        <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
          Usuário / E-mail
        </Text>

        <TextInput
          value={usuario?.username || ''}
          editable={false}
          style={{
            backgroundColor: '#1a1a1a',
            color: '#fff',
            padding: 18,
            borderRadius: 18,
            fontSize: 18,
            marginBottom: 22,
            borderWidth: 1,
            borderColor: '#333',
            opacity: 0.7,
          }}
        />

        {ehUsuarioComum ? (
          <>
            <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
              CEP
            </Text>

            <TextInput
              value={cep}
              onChangeText={alterarCep}
              editable={editando && !buscandoCep}
              keyboardType="numeric"
              maxLength={9}
              placeholder="00000-000"
              placeholderTextColor="#777"
              style={{
                backgroundColor: '#1a1a1a',
                color: '#fff',
                padding: 18,
                borderRadius: 18,
                fontSize: 18,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#f97316',
                opacity: editando ? 1 : 0.7,
              }}
            />

            {buscandoCep ? (
              <View style={{ marginBottom: 15 }}>
                <ActivityIndicator color="#f97316" />

                <Text
                  style={{
                    color: '#ccc',
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  Buscando endereço pelo CEP...
                </Text>
              </View>
            ) : null}

            {deveMostrarCamposEndereco ? (
              <>
                <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
                  Endereço
                </Text>

                <TextInput
                  value={endereco}
                  editable={false}
                  placeholder="Preenchido automaticamente pelo CEP"
                  placeholderTextColor="#777"
                  style={{
                    backgroundColor: '#111',
                    color: '#ccc',
                    padding: 18,
                    borderRadius: 18,
                    fontSize: 18,
                    marginBottom: 18,
                    borderWidth: 1,
                    borderColor: '#333',
                    opacity: 0.8,
                  }}
                />

                <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
                  Bairro
                </Text>

                <TextInput
                  value={bairro}
                  editable={false}
                  placeholder="Preenchido automaticamente pelo CEP"
                  placeholderTextColor="#777"
                  style={{
                    backgroundColor: '#111',
                    color: '#ccc',
                    padding: 18,
                    borderRadius: 18,
                    fontSize: 18,
                    marginBottom: 18,
                    borderWidth: 1,
                    borderColor: '#333',
                    opacity: 0.8,
                  }}
                />

                <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
                  Cidade
                </Text>

                <TextInput
                  value={cidade}
                  editable={false}
                  placeholder="Preenchida automaticamente pelo CEP"
                  placeholderTextColor="#777"
                  style={{
                    backgroundColor: '#111',
                    color: '#ccc',
                    padding: 18,
                    borderRadius: 18,
                    fontSize: 18,
                    marginBottom: 18,
                    borderWidth: 1,
                    borderColor: '#333',
                    opacity: 0.8,
                  }}
                />

                <Text style={{ color: '#aaa', fontSize: 18, marginBottom: 8 }}>
                  Estado
                </Text>

                <TextInput
                  value={estado}
                  editable={false}
                  placeholder="UF"
                  placeholderTextColor="#777"
                  style={{
                    backgroundColor: '#111',
                    color: '#ccc',
                    padding: 18,
                    borderRadius: 18,
                    fontSize: 18,
                    marginBottom: 25,
                    borderWidth: 1,
                    borderColor: '#333',
                    opacity: 0.8,
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}

        {!editando ? (
          <TouchableOpacity
            onPress={() => {
              setMensagem('');
              setEditando(true);
            }}
            style={{
              backgroundColor: '#f97316',
              padding: 16,
              borderRadius: 15,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              Editar Perfil
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={salvarPerfil}
            disabled={salvando || buscandoCep}
            style={{
              backgroundColor: salvando || buscandoCep ? '#9a4d12' : '#f97316',
              padding: 16,
              borderRadius: 15,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {salvando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Salvar Alterações
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={abrirAlterarSenhaWeb}
          style={{
            backgroundColor: '#111',
            padding: 16,
            borderRadius: 15,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#f97316',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: '#f97316',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            Alterar Senha
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={sair}
          style={{
            backgroundColor: '#111',
            padding: 16,
            borderRadius: 15,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#333',
          }}
        >
          <Text
            style={{
              color: '#ffb4b4',
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            Sair da conta
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomTabBar usuario={usuario} />
    </KeyboardAvoidingView>
  );
}