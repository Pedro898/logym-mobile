import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';

import {
  alternarFavoritoNoBanco,
  buscarFavoritosDoUsuario,
  buscarPrimeiraFotoAcademia,
  buscarUsuarioAutenticado,
  getFotoAcademiaUrl,
  type Academia,
  type Usuario,
} from '@/lib/api';
import { ehUsuarioComum } from '@/lib/permissoes';

type AcademiaFavorita = Academia & {
  fotoUrl?: string | null;
};

// Pega a primeira letra do nome da academia.
// Essa letra aparece quando a academia não tem foto cadastrada.
function getInicialAcademia(nome?: string) {
  const nomeLimpo = String(nome || 'A').trim();

  if (!nomeLimpo) {
    return 'A';
  }

  return nomeLimpo.charAt(0).toUpperCase();
}

// Mesmo visual usado na Home:
// fundo degradê escuro/laranja,
// círculo branco,
// borda laranja,
// inicial preta no centro.
function AcademiaSemFoto({ nome }: { nome?: string }) {
  return (
    <LinearGradient
      colors={['#1a0700', '#f97316']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: '#fff',
          borderWidth: 2,
          borderColor: '#f97316',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#000',
            fontSize: 34,
            fontWeight: '900',
          }}
        >
          {getInicialAcademia(nome)}
        </Text>
      </View>
    </LinearGradient>
  );
}

export default function Favoritos() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [academiasFavoritas, setAcademiasFavoritas] = useState<AcademiaFavorita[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useFocusEffect(
    useCallback(() => {
      async function carregarFavoritos() {
        try {
          setCarregando(true);
          setErro('');

          let usuarioLogado: Usuario | null = null;

          try {
            usuarioLogado = await buscarUsuarioAutenticado();

            await AsyncStorage.setItem(
              'usuario',
              JSON.stringify(usuarioLogado)
            );

            setUsuario(usuarioLogado);

            // Favoritos são exclusivos de USER.
            // MANAGER/ADMIN são direcionados ao painel administrativo.
            if (!ehUsuarioComum(usuarioLogado)) {
              setAcademiasFavoritas([]);
              router.replace('/painel');
              return;
            }
          } catch (error) {
            console.error('Sessão inválida ou expirada:', error);

            await AsyncStorage.removeItem('usuario');
            setUsuario(null);
            setAcademiasFavoritas([]);
            router.replace('/login');
            return;
          }

          if (!usuarioLogado?.id) {
            setAcademiasFavoritas([]);
            setErro('Usuário não encontrado. Faça login novamente.');
            return;
          }

          // Busca as academias favoritas reais do banco.
          const academiasBanco = await buscarFavoritosDoUsuario(usuarioLogado.id);

          // Para cada academia favorita, tenta buscar a primeira foto cadastrada.
          // Se não tiver foto, fotoUrl fica null e mostramos o fallback com a inicial.
          const academiasComFotos = await Promise.all(
            academiasBanco.map(async (academia) => {
              try {
                const primeiraFoto = await buscarPrimeiraFotoAcademia(academia.id);

                return {
                  ...academia,
                  fotoUrl: primeiraFoto
                    ? getFotoAcademiaUrl(primeiraFoto.id)
                    : null,
                };
              } catch (error) {
                console.error(
                  `Erro ao buscar foto da academia favorita ${academia.id}:`,
                  error
                );

                return {
                  ...academia,
                  fotoUrl: null,
                };
              }
            })
          );

          setAcademiasFavoritas(academiasComFotos);
        } catch (error) {
          console.error(error);
          setErro('Erro ao carregar favoritos do banco.');
        } finally {
          setCarregando(false);
        }
      }

      carregarFavoritos();
    }, [])
  );

  async function removerFavorito(academiaId: string | number) {
    if (!usuario?.id || !ehUsuarioComum(usuario)) {
      return;
    }

    const idString = String(academiaId);
    const listaAnterior = academiasFavoritas;

    // Remove visualmente na hora.
    setAcademiasFavoritas((listaAtual) =>
      listaAtual.filter((academia) => String(academia.id) !== idString)
    );

    try {
      // Remove no banco usando a mesma rota de toggle.
      await alternarFavoritoNoBanco(usuario.id, academiaId);
    } catch (error) {
      console.error('Erro ao remover favorito do banco:', error);

      // Se der erro, volta a lista anterior.
      setAcademiasFavoritas(listaAnterior);
      setErro('Erro ao remover favorito do banco.');
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        paddingTop: 60,
        paddingHorizontal: 15,
        paddingBottom: 86,
      }}
    >
      <TouchableOpacity
        onPress={() => router.replace('/academias')}
        style={{ marginBottom: 25 }}
      >
        <Ionicons name="arrow-back-outline" size={35} color="#f97316" />
      </TouchableOpacity>

      <Text
        style={{
          color: '#fff',
          fontSize: 28,
          fontWeight: 'bold',
          marginBottom: 25,
        }}
      >
        Academias Favoritas
      </Text>

      {carregando ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color="#f97316" />

          <Text
            style={{
              color: '#fff',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            Carregando favoritos do banco...
          </Text>
        </View>
      ) : erro ? (
        <Text style={{ color: '#ffb4b4', fontSize: 16 }}>
          {erro}
        </Text>
      ) : academiasFavoritas.length === 0 ? (
        <Text style={{ color: '#ccc', fontSize: 16 }}>
          Você ainda não favoritou nenhuma academia.
        </Text>
      ) : (
        <FlatList
          data={academiasFavoritas}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 18 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/detalhes',
                  params: { id: String(item.id) },
                })
              }
              style={{
                flexDirection: 'row',
                backgroundColor: '#0a0a0a',
                borderRadius: 20,
                marginBottom: 15,
                overflow: 'hidden',
              }}
            >
              {item.fotoUrl ? (
                <Image
                  source={{ uri: item.fotoUrl }}
                  style={{
                    width: 120,
                    height: 120,
                    backgroundColor: '#111',
                  }}
                />
              ) : (
                <AcademiaSemFoto nome={item.nome} />
              )}

              <View style={{ flex: 1, padding: 10 }}>
                <Text
                  style={{
                    color: '#f97316',
                    fontSize: 18,
                    fontWeight: 'bold',
                  }}
                >
                  {item.nome}
                </Text>

                <Text style={{ color: '#ccc', marginTop: 5 }}>
                  {item.endereco}
                  {item.numero ? `, ${item.numero}` : ''}
                </Text>

                <Text style={{ color: '#ccc' }}>
                  {item.bairro ? `${item.bairro} - ` : ''}
                  {item.cidade}
                  {item.estado ? `, ${item.estado}` : ''}
                </Text>

                <Text style={{ color: '#f97316', marginTop: 5 }}>
                  CEP: {item.cep}
                </Text>

                {item.nota !== null && item.nota !== undefined ? (
                  <Text style={{ color: '#fff', marginTop: 4 }}>
                    {Number(item.nota).toFixed(1)} ⭐
                  </Text>
                ) : (
                  <Text style={{ color: '#777', marginTop: 4 }}>
                    Sem avaliações
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={(event) => {
                  event.stopPropagation();
                  removerFavorito(item.id);
                }}
                style={{
                  justifyContent: 'flex-end',
                  padding: 10,
                }}
              >
                <Ionicons name="star" size={26} color="#facc15" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <BottomTabBar usuario={usuario} />
    </View>
  );
}