import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import UserAvatarPlaceholder from '../components/UserAvatarPlaceholder';

import {
  alternarFavoritoNoBanco,
  buscarAcademias,
  buscarAcademiasProximasDoUsuario,
  buscarCategoriasAtivas,
  buscarFacilidadesAtivas,
  buscarFavoritosDoUsuario,
  buscarPrimeiraFotoAcademia,
  buscarUsuarioAutenticado,
  extrairIdsAcademiasFavoritas,
  formatarNomeUsuario,
  getFotoAcademiaUrl,
  getFotoUsuarioUrl,
  normalizarCategorias,
  normalizarFacilidades,

  type Academia,
  type Categoria,
  type Facilidade,
  type Usuario,
} from '@/lib/api';
import { ehUsuarioComum } from '@/lib/permissoes';

// ================================================================
// ACADEMIA COM FOTO
// ================================================================

type AcademiaComFoto = Academia & {
  fotoUrl?: string | null;
};

// ================================================================
// PEGA A PRIMEIRA LETRA DO NOME DA ACADEMIA
//
// Exemplo:
// Smart Fit -> S
// BlueFit   -> B
// ================================================================

function getInicialAcademia(nome?: string) {
  const nomeLimpo = String(nome || 'A').trim();

  if (!nomeLimpo) {
    return 'A';
  }

  return nomeLimpo.charAt(0).toUpperCase();
}

// ================================================================
// NORMALIZA TEXTOS
//
// Essa função ajuda na pesquisa.
//
// Por exemplo:
//
// "Musculação"
// "musculacao"
//
// passam a ser tratados de forma semelhante.
// ================================================================

function normalizarTexto(texto?: string) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ================================================================
// FALLBACK DA FOTO DA ACADEMIA
//
// Se a academia não possuir uma foto cadastrada,
// mostramos o mesmo estilo usado no projeto:
// fundo degradê + círculo branco + inicial da academia.
// ================================================================

function AcademiaSemFoto({
  nome,
}: {
  nome?: string;
}) {
  return (
    <LinearGradient
      colors={['#1a0700', '#f97316']}
      start={{
        x: 0,
        y: 0,
      }}
      end={{
        x: 1,
        y: 1,
      }}
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

// ================================================================
// TELA PRINCIPAL DE ACADEMIAS
// ================================================================

export default function Academias() {
  const router = useRouter();

  // ==============================================================
  // PESQUISA
  // ==============================================================

  const [busca, setBusca] = useState('');

  // ==============================================================
  // CATEGORIAS
  // ==============================================================

  const [categorias, setCategorias] =
    useState<Categoria[]>([]);

  const [
    categoriasSelecionadas,
    setCategoriasSelecionadas,
  ] = useState<string[]>([]);

  // ==============================================================
  // FACILIDADES
  // ==============================================================

  const [facilidades, setFacilidades] =
    useState<Facilidade[]>([]);

  const [
    facilidadesSelecionadas,
    setFacilidadesSelecionadas,
  ] = useState<string[]>([]);

  // ==============================================================
  // CARREGAMENTO DOS FILTROS
  // ==============================================================

  const [
    carregandoFiltros,
    setCarregandoFiltros,
  ] = useState(false);

  const [erroFiltros, setErroFiltros] =
    useState('');

  // ==============================================================
  // FAVORITOS
  // ==============================================================

  const [favoritos, setFavoritos] =
    useState<string[]>([]);

  // ==============================================================
  // USUÁRIO
  // ==============================================================

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  // Se a foto falhar, mostramos o avatar padrão.
  const [
    fotoUsuarioErro,
    setFotoUsuarioErro,
  ] = useState(false);

  // ==============================================================
  // VERSÃO DA FOTO DO USUÁRIO
  //
  // Esse estado serve somente para evitar o cache da imagem.
  //
  // Quando entramos novamente nesta tela, depois de alterar a
  // foto no Perfil, mudamos esse número.
  //
  // Exemplo:
  //
  // /usuarios/1/foto?v=123
  //
  // depois:
  //
  // /usuarios/1/foto?v=456
  //
  // Como a URL ficou diferente, o React Native busca novamente
  // a imagem no backend.
  //
  // IMPORTANTE:
  // Date.now() NÃO fica dentro de getFotoUsuarioUrl().
  //
  // Assim a foto não fica piscando a cada renderização.
  // ==============================================================

  const [
    fotoUsuarioVersao,
    setFotoUsuarioVersao,
  ] = useState(Date.now());

  // ==============================================================
  // ACADEMIAS
  // ==============================================================

  const [academias, setAcademias] =
    useState<AcademiaComFoto[]>([]);

  const [
    carregandoAcademias,
    setCarregandoAcademias,
  ] = useState(false);

  const [
    erroAcademias,
    setErroAcademias,
  ] = useState('');

  // ==============================================================
  // CARREGA OS DADOS SEMPRE QUE A TELA RECEBE FOCO
  //
  // Isso é importante porque podemos sair para:
  //
  // - Perfil
  // - Favoritos
  // - Detalhes
  //
  // e depois voltar.
  //
  // Ao voltar, atualizamos novamente os dados necessários.
  // ==============================================================

  useFocusEffect(
    useCallback(() => {
      async function carregarDados() {
        // ========================================================
        // ATUALIZA A VERSÃO DA FOTO
        //
        // Essa é a correção para a foto alterada no Perfil.
        //
        // Quando voltamos para a tela principal, a URL da imagem
        // muda e o cache antigo deixa de ser utilizado.
        // ========================================================

        setFotoUsuarioVersao(Date.now());

        // Tentamos carregar novamente a foto.
        setFotoUsuarioErro(false);

        // ========================================================
        // USUÁRIO AUTENTICADO
        //
        // A fonte verdadeira da autenticação é a sessão do Spring.
        // Assim, ao atualizar a página no navegador, não usamos um
        // usuário antigo do AsyncStorage por engano.
        // ========================================================

        let usuarioLogado: Usuario | null = null;

        try {
          usuarioLogado = await buscarUsuarioAutenticado();

          await AsyncStorage.setItem(
            'usuario',
            JSON.stringify(usuarioLogado)
          );

          setUsuario(usuarioLogado);
        } catch (error) {
          console.error('Sessão inválida ou expirada:', error);

          await AsyncStorage.removeItem('usuario');
          setUsuario(null);
          router.replace('/login');
          return;
        }

        // ========================================================
        // CATEGORIAS E FACILIDADES
        // ========================================================

        try {
          setCarregandoFiltros(true);

          setErroFiltros('');

          const [
            categoriasBanco,
            facilidadesBanco,
          ] = await Promise.all([
            buscarCategoriasAtivas(),
            buscarFacilidadesAtivas(),
          ]);

          setCategorias(
            Array.isArray(categoriasBanco)
              ? categoriasBanco
              : []
          );

          setFacilidades(
            Array.isArray(facilidadesBanco)
              ? facilidadesBanco
              : []
          );
        } catch (error) {
          console.error(
            'Erro ao carregar categorias e facilidades:',
            error
          );

          setCategorias([]);

          setFacilidades([]);

          setErroFiltros(
            'Não foi possível carregar os filtros.'
          );
        } finally {
          setCarregandoFiltros(false);
        }

        // ========================================================
        // ACADEMIAS
        // ========================================================

        try {
          setCarregandoAcademias(true);

          setErroAcademias('');

          // ======================================================
          // FAVORITOS
          // ======================================================

          if (usuarioLogado?.id && ehUsuarioComum(usuarioLogado)) {
            try {
              const academiasFavoritas =
                await buscarFavoritosDoUsuario(
                  usuarioLogado.id
                );

              setFavoritos(
                extrairIdsAcademiasFavoritas(
                  academiasFavoritas
                )
              );
            } catch (error) {
              console.error(
                'Erro ao buscar favoritos:',
                error
              );

              setFavoritos([]);
            }
          } else {
            setFavoritos([]);
          }

          // ======================================================
          // BUSCA DAS ACADEMIAS
          //
          // Usuário logado:
          // busca ordenada por proximidade do CEP.
          //
          // Sem usuário:
          // busca todas.
          // ======================================================

          const lista = usuarioLogado?.id
            ? await buscarAcademiasProximasDoUsuario(
                usuarioLogado.id
              )
            : await buscarAcademias();

          // ======================================================
          // FOTOS DAS ACADEMIAS
          // ======================================================

          const listaComFotos =
            await Promise.all(
              lista.map(
                async (academia) => {
                  try {
                    const primeiraFoto =
                      await buscarPrimeiraFotoAcademia(
                        academia.id
                      );

                    return {
                      ...academia,

                      fotoUrl:
                        primeiraFoto
                          ? getFotoAcademiaUrl(
                              primeiraFoto.id
                            )
                          : null,
                    };
                  } catch (error) {
                    console.error(
                      `Erro ao buscar foto da academia ${academia.id}:`,
                      error
                    );

                    return {
                      ...academia,
                      fotoUrl: null,
                    };
                  }
                }
              )
            );

          setAcademias(listaComFotos);
        } catch (error) {
          console.error(
            'Erro ao carregar academias:',
            error
          );

          setErroAcademias(
            'Não foi possível carregar as academias do banco.'
          );
        } finally {
          setCarregandoAcademias(false);
        }
      }

      carregarDados();
    }, [])
  );

  // ==============================================================
  // ALTERAR CATEGORIA SELECIONADA
  // ==============================================================

  function alternarCategoria(
    id: string | number
  ) {
    const idString = String(id);

    setCategoriasSelecionadas(
      (listaAtual) => {
        if (
          listaAtual.includes(
            idString
          )
        ) {
          return listaAtual.filter(
            (item) =>
              item !== idString
          );
        }

        return [
          ...listaAtual,
          idString,
        ];
      }
    );
  }

  // ==============================================================
  // ALTERAR FACILIDADE SELECIONADA
  // ==============================================================

  function alternarFacilidade(
    id: string | number
  ) {
    const idString = String(id);

    setFacilidadesSelecionadas(
      (listaAtual) => {
        if (
          listaAtual.includes(
            idString
          )
        ) {
          return listaAtual.filter(
            (item) =>
              item !== idString
          );
        }

        return [
          ...listaAtual,
          idString,
        ];
      }
    );
  }

  // ==============================================================
  // LIMPAR PESQUISA E FILTROS
  // ==============================================================

  function limparFiltros() {
    setCategoriasSelecionadas([]);

    setFacilidadesSelecionadas([]);

    setBusca('');
  }

  // ==============================================================
  // VERIFICA SE A ACADEMIA POSSUI UMA CATEGORIA
  // ==============================================================

  function academiaPossuiCategoria(
    academia: Academia,
    categoria: Categoria
  ) {
    // ============================================================
    // MODELO NOVO - IDS
    // ============================================================

    if (
      Array.isArray(
        academia.categoriaIds
      ) &&
      academia.categoriaIds
        .length > 0
    ) {
      return academia.categoriaIds.some(
        (id) =>
          String(id) ===
          String(categoria.id)
      );
    }

    // ============================================================
    // MODELO NOVO - OBJETOS VINCULADOS
    // ============================================================

    if (
      Array.isArray(
        academia.categoriasVinculadas
      ) &&
      academia
        .categoriasVinculadas
        .length > 0
    ) {
      return academia.categoriasVinculadas.some(
        (item) =>
          String(item.id) ===
            String(categoria.id) ||
          normalizarTexto(
            item.nome
          ) ===
            normalizarTexto(
              categoria.nome
            )
      );
    }

    // ============================================================
    // MODELO ANTIGO - STRING
    // ============================================================

    const antigas =
      normalizarCategorias(
        academia.categorias
      );

    return antigas.some(
      (nome) =>
        normalizarTexto(
          nome
        ) ===
        normalizarTexto(
          categoria.nome
        )
    );
  }

  // ==============================================================
  // VERIFICA SE A ACADEMIA POSSUI UMA FACILIDADE
  // ==============================================================

  function academiaPossuiFacilidade(
    academia: Academia,
    facilidade: Facilidade
  ) {
    // ============================================================
    // MODELO NOVO - IDS
    // ============================================================

    if (
      Array.isArray(
        academia.facilidadeIds
      ) &&
      academia.facilidadeIds
        .length > 0
    ) {
      return academia.facilidadeIds.some(
        (id) =>
          String(id) ===
          String(
            facilidade.id
          )
      );
    }

    // ============================================================
    // MODELO NOVO - OBJETOS VINCULADOS
    // ============================================================

    if (
      Array.isArray(
        academia.facilidadesVinculadas
      ) &&
      academia
        .facilidadesVinculadas
        .length > 0
    ) {
      return academia.facilidadesVinculadas.some(
        (item) =>
          String(item.id) ===
            String(
              facilidade.id
            ) ||
          normalizarTexto(
            item.nome
          ) ===
            normalizarTexto(
              facilidade.nome
            )
      );
    }

    // ============================================================
    // MODELO ANTIGO - STRING
    // ============================================================

    const antigas =
      normalizarFacilidades(
        academia.facilidades
      );

    return antigas.some(
      (nome) =>
        normalizarTexto(
          nome
        ) ===
        normalizarTexto(
          facilidade.nome
        )
    );
  }

  // ==============================================================
  // CRIA O TEXTO UTILIZADO NA PESQUISA
  // ==============================================================

  function criarTextoPesquisavel(
    academia: Academia
  ) {
    const nomesCategorias = [
      ...(
        academia.categoriasVinculadas ||
        []
      ).map(
        (item) => item.nome
      ),

      ...normalizarCategorias(
        academia.categorias
      ),
    ].join(' ');

    const nomesFacilidades = [
      ...(
        academia.facilidadesVinculadas ||
        []
      ).map(
        (item) => item.nome
      ),

      ...normalizarFacilidades(
        academia.facilidades
      ),
    ].join(' ');

    return normalizarTexto(`
      ${academia.nome}
      ${academia.endereco}
      ${academia.numero || ''}
      ${academia.complemento || ''}
      ${academia.bairro || ''}
      ${academia.cidade}
      ${academia.estado || ''}
      ${academia.cep}
      ${academia.descricao || ''}
      ${nomesCategorias}
      ${nomesFacilidades}
    `);
  }

  // ==============================================================
  // FILTRAGEM DAS ACADEMIAS
  // ==============================================================

  const academiasFiltradas =
    academias.filter(
      (academia) => {
        // ========================================================
        // PESQUISA
        // ========================================================

        const termoBusca =
          normalizarTexto(
            busca.trim()
          );

        const correspondeBusca =
          termoBusca
            ? criarTextoPesquisavel(
                academia
              ).includes(
                termoBusca
              )
            : true;

        // ========================================================
        // CATEGORIAS
        // ========================================================

        const correspondeCategorias =
          categoriasSelecionadas
            .length > 0
            ? categoriasSelecionadas.every(
                (
                  categoriaId
                ) => {
                  const categoria =
                    categorias.find(
                      (item) =>
                        String(
                          item.id
                        ) ===
                        categoriaId
                    );

                  return categoria
                    ? academiaPossuiCategoria(
                        academia,
                        categoria
                      )
                    : false;
                }
              )
            : true;

        // ========================================================
        // FACILIDADES
        // ========================================================

        const correspondeFacilidades =
          facilidadesSelecionadas
            .length > 0
            ? facilidadesSelecionadas.every(
                (
                  facilidadeId
                ) => {
                  const facilidade =
                    facilidades.find(
                      (item) =>
                        String(
                          item.id
                        ) ===
                        facilidadeId
                    );

                  return facilidade
                    ? academiaPossuiFacilidade(
                        academia,
                        facilidade
                      )
                    : false;
                }
              )
            : true;

        return (
          correspondeBusca &&
          correspondeCategorias &&
          correspondeFacilidades
        );
      }
    );

  // ==============================================================
  // FAVORITAR / DESFAVORITAR
  // ==============================================================

  async function alternarFavorito(
    id: string | number
  ) {
    if (!usuario?.id || !ehUsuarioComum(usuario)) {
      return;
    }

    const idString =
      String(id);

    const favoritosAnteriores =
      favoritos;

    const novosFavoritos =
      favoritos.includes(
        idString
      )
        ? favoritos.filter(
            (favoritoId) =>
              favoritoId !==
              idString
          )
        : [
            ...favoritos,
            idString,
          ];

    // Atualização visual imediata.
    setFavoritos(
      novosFavoritos
    );

    try {
      await alternarFavoritoNoBanco(
        usuario.id,
        id
      );
    } catch (error) {
      console.error(
        'Erro ao atualizar favorito:',
        error
      );

      // Volta ao estado anterior caso o backend dê erro.
      setFavoritos(
        favoritosAnteriores
      );
    }
  }

  // ==============================================================
  // INFORMAÇÕES DO USUÁRIO
  // ==============================================================

  const nomeUsuario =
    formatarNomeUsuario(
      usuario
    );

  // ==============================================================
  // URL BASE DA FOTO
  //
  // getFotoUsuarioUrl continua SEM Date.now().
  // Isso evita a imagem piscando continuamente.
  // ==============================================================

  const fotoUsuarioBaseUrl =
    getFotoUsuarioUrl(
      usuario?.id
    );

  // ==============================================================
  // URL COM VERSÃO
  //
  // A versão muda somente quando a tela recebe foco novamente.
  //
  // Portanto, ao voltar do Perfil, o Mobile força uma nova busca
  // da imagem e mostra imediatamente a foto recém-alterada.
  // ==============================================================

  const fotoUsuarioUrl =
    fotoUsuarioBaseUrl
      ? `${fotoUsuarioBaseUrl}?v=${fotoUsuarioVersao}`
      : null;

  const deveMostrarFotoUsuario =
    fotoUsuarioUrl &&
    !fotoUsuarioErro;

  // ==============================================================
  // INTERFACE
  // ==============================================================

  return (
    <View
      style={{
        flex: 1,

        backgroundColor:
          '#000',

        paddingTop: 8,

        paddingHorizontal:
          15,

        paddingBottom: 86,
      }}
    >
      {/* ==========================================================
          LOGO
      ========================================================== */}

      <View
        style={{
          width: '100%',

          alignItems:
            'center',

          justifyContent:
            'center',

          marginBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection:
              'row',

            alignItems:
              'center',

            justifyContent:
              'center',
          }}
        >
          <Image
            source={require('../assets/images/logoSimples.png')}
            style={{
              width: 82,
              height: 82,
            }}
            resizeMode="contain"
          />

          <Text
            style={{
              color: '#fff',

              fontSize: 31,

              fontWeight:
                '900',

              marginLeft: 4,

              letterSpacing:
                0.8,

              includeFontPadding:
                false,
            }}
          >
            LOGYM
          </Text>
        </View>
      </View>

      {/* ==========================================================
          USUÁRIO
          
          Sem card/retângulo ao redor, como você preferiu.
      ========================================================== */}

      <View
        style={{
          flexDirection:
            'row',

          alignItems:
            'center',

          marginBottom: 18,
        }}
      >
        {deveMostrarFotoUsuario ? (
          <Image
            source={{
              uri: fotoUsuarioUrl,
            }}
            onError={() =>
              setFotoUsuarioErro(
                true
              )
            }
            style={{
              width: 46,

              height: 46,

              borderRadius: 23,

              backgroundColor:
                '#222',

              borderWidth: 1,

              borderColor:
                '#f97316',
            }}
          />
        ) : (
          <UserAvatarPlaceholder
            size={46}
          />
        )}

        <View
          style={{
            marginLeft: 12,

            flex: 1,
          }}
        >
          <Text
            style={{
              color: '#888',

              fontSize: 12,

              marginBottom: 3,
            }}
          >
            Bem-vindo
          </Text>

          <Text
            numberOfLines={1}
            style={{
              color: '#fff',

              fontSize: 17,

              fontWeight:
                'bold',
            }}
          >
            {nomeUsuario}
          </Text>
        </View>
      </View>

      {/* ==========================================================
          BUSCA
      ========================================================== */}

      <View
        style={{
          marginBottom: 15,
        }}
      >
        <View
          style={{
            flexDirection:
              'row',

            alignItems:
              'center',

            backgroundColor:
              '#111',

            borderRadius: 20,

            paddingHorizontal:
              15,

            borderWidth: 1,

            borderColor:
              '#222',
          }}
        >
          <Ionicons
            name="search"
            size={20}
            color="#888"
          />

          <TextInput
            placeholder="Localizar academias"
            placeholderTextColor="#888"
            value={busca}
            onChangeText={
              setBusca
            }
            style={{
              flex: 1,

              color: '#fff',

              marginLeft: 10,

              minHeight: 46,
            }}
          />
        </View>

        {/* ========================================================
            TÍTULO DOS FILTROS
        ======================================================== */}

        <View
          style={{
            marginTop: 16,

            marginBottom: 8,

            flexDirection:
              'row',

            alignItems:
              'center',

            justifyContent:
              'space-between',
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
            Filtros rápidos
          </Text>

          {(categoriasSelecionadas.length >
            0 ||
            facilidadesSelecionadas.length >
              0 ||
            busca.length > 0) && (
            <TouchableOpacity
              onPress={
                limparFiltros
              }
            >
              <Text
                style={{
                  color:
                    '#f97316',

                  fontWeight:
                    'bold',
                }}
              >
                Limpar
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================
            CARREGAMENTO DOS FILTROS
        ======================================================== */}

        {carregandoFiltros ? (
          <Text
            style={{
              color: '#888',

              marginBottom: 8,

              fontSize: 13,
            }}
          >
            Carregando filtros...
          </Text>
        ) : null}

        {/* ========================================================
            ERRO DOS FILTROS
        ======================================================== */}

        {erroFiltros ? (
          <Text
            style={{
              color:
                '#ffb4b4',

              marginBottom: 8,

              fontSize: 13,
            }}
          >
            {erroFiltros}
          </Text>
        ) : null}

        {/* ========================================================
            FILTROS DINÂMICOS
        ======================================================== */}

        {!carregandoFiltros ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={{
              gap: 8,

              paddingBottom: 8,
            }}
          >
            {/* ====================================================
                CATEGORIAS
            ==================================================== */}

            {categorias.map(
              (categoria) => {
                const selecionada =
                  categoriasSelecionadas.includes(
                    String(
                      categoria.id
                    )
                  );

                return (
                  <TouchableOpacity
                    key={`categoria-${categoria.id}`}
                    onPress={() =>
                      alternarCategoria(
                        categoria.id
                      )
                    }
                    style={{
                      backgroundColor:
                        selecionada
                          ? '#f97316'
                          : '#111',

                      borderColor:
                        selecionada
                          ? '#f97316'
                          : '#333',

                      borderRadius:
                        18,

                      borderWidth:
                        1,

                      paddingHorizontal:
                        14,

                      paddingVertical:
                        8,

                      flexDirection:
                        'row',

                      alignItems:
                        'center',
                    }}
                  >
                    {selecionada ? (
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color="#000"
                        style={{
                          marginRight:
                            4,
                        }}
                      />
                    ) : null}

                    <Text
                      style={{
                        color:
                          selecionada
                            ? '#000'
                            : '#fff',

                        fontWeight:
                          'bold',
                      }}
                    >
                      {
                        categoria.nome
                      }
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}

            {/* ====================================================
                FACILIDADES
            ==================================================== */}

            {facilidades.map(
              (facilidade) => {
                const selecionada =
                  facilidadesSelecionadas.includes(
                    String(
                      facilidade.id
                    )
                  );

                return (
                  <TouchableOpacity
                    key={`facilidade-${facilidade.id}`}
                    onPress={() =>
                      alternarFacilidade(
                        facilidade.id
                      )
                    }
                    style={{
                      backgroundColor:
                        selecionada
                          ? '#f97316'
                          : '#111',

                      borderColor:
                        selecionada
                          ? '#f97316'
                          : '#333',

                      borderRadius:
                        18,

                      borderWidth:
                        1,

                      paddingHorizontal:
                        14,

                      paddingVertical:
                        8,

                      flexDirection:
                        'row',

                      alignItems:
                        'center',
                    }}
                  >
                    {selecionada ? (
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color="#000"
                        style={{
                          marginRight:
                            4,
                        }}
                      />
                    ) : null}

                    <Text
                      style={{
                        color:
                          selecionada
                            ? '#000'
                            : '#fff',

                        fontWeight:
                          'bold',
                      }}
                    >
                      {
                        facilidade.nome
                      }
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>
        ) : null}

        {/* ========================================================
            QUANTIDADE DE RESULTADOS
        ======================================================== */}

        <Text
          style={{
            color: '#ccc',

            fontSize: 14,

            marginTop: 2,
          }}
        >
          Resultado:{' '}
          {academiasFiltradas.length}{' '}
          academia(s)
        </Text>
      </View>

      {/* ==========================================================
          CARREGANDO ACADEMIAS
      ========================================================== */}

      {carregandoAcademias ? (
        <View
          style={{
            marginTop: 40,
          }}
        >
          <ActivityIndicator
            color="#f97316"
          />

          <Text
            style={{
              color: '#fff',

              textAlign:
                'center',

              marginTop: 10,
            }}
          >
            Carregando academias do banco...
          </Text>
        </View>
      ) : erroAcademias ? (
        // ========================================================
        // ERRO
        // ========================================================

        <View
          style={{
            marginTop: 40,
          }}
        >
          <Text
            style={{
              color:
                '#ffb4b4',

              textAlign:
                'center',
            }}
          >
            {erroAcademias}
          </Text>
        </View>
      ) : academiasFiltradas.length ===
        0 ? (
        // ========================================================
        // NENHUMA ACADEMIA
        // ========================================================

        <View
          style={{
            marginTop: 40,
          }}
        >
          <Text
            style={{
              color: '#ccc',

              textAlign:
                'center',
            }}
          >
            Nenhuma academia encontrada com esses filtros.
          </Text>
        </View>
      ) : (
        // ========================================================
        // LISTA DAS ACADEMIAS
        // ========================================================

        <FlatList
          data={
            academiasFiltradas
          }
          keyExtractor={(item) =>
            String(item.id)
          }
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingBottom: 18,
          }}
          renderItem={({
            item,
          }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname:
                    '/detalhes',

                  params: {
                    id: String(
                      item.id
                    ),
                  },
                })
              }
              style={{
                flexDirection:
                  'row',

                backgroundColor:
                  '#0a0a0a',

                borderRadius: 20,

                marginBottom: 15,

                overflow:
                  'hidden',

                borderWidth: 1,

                borderColor:
                  '#1f1f1f',
              }}
            >
              {/* ==================================================
                  FOTO DA ACADEMIA
              ================================================== */}

              {item.fotoUrl ? (
                <Image
                  source={{
                    uri:
                      item.fotoUrl,
                  }}
                  style={{
                    width: 120,

                    height: 120,

                    backgroundColor:
                      '#111',
                  }}
                />
              ) : (
                <AcademiaSemFoto
                  nome={item.nome}
                />
              )}

              {/* ==================================================
                  INFORMAÇÕES DA ACADEMIA
              ================================================== */}

              <View
                style={{
                  flex: 1,

                  padding: 10,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color:
                      '#f97316',

                    fontSize: 18,

                    fontWeight:
                      'bold',
                  }}
                >
                  {item.nome}
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    color: '#ccc',

                    marginTop: 5,
                  }}
                >
                  {item.endereco}

                  {item.numero
                    ? `, ${item.numero}`
                    : ''}
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    color: '#ccc',
                  }}
                >
                  {item.bairro
                    ? `${item.bairro} - `
                    : ''}

                  {item.cidade}

                  {item.estado
                    ? `, ${item.estado}`
                    : ''}
                </Text>

                <Text
                  style={{
                    color:
                      '#f97316',

                    marginTop: 5,
                  }}
                >
                  CEP: {item.cep}
                </Text>

                {/* =================================================
                    NOTA
                ================================================= */}

                {item.nota !==
                  null &&
                item.nota !==
                  undefined ? (
                  <Text
                    style={{
                      color:
                        '#fff',

                      marginTop: 4,
                    }}
                  >
                    {Number(
                      item.nota
                    ).toFixed(
                      1
                    )}{' '}
                    ⭐
                  </Text>
                ) : (
                  <Text
                    style={{
                      color:
                        '#777',

                      marginTop: 4,
                    }}
                  >
                    Sem avaliações
                  </Text>
                )}
              </View>

              {/* ==================================================
                  FAVORITO
              ================================================== */}

              {ehUsuarioComum(usuario) ? (
                <TouchableOpacity
                  onPress={(event) => {
                    // Favoritos são uma função exclusiva de USER.
                    event.stopPropagation();

                    alternarFavorito(item.id);
                  }}
                  style={{
                    justifyContent: 'flex-end',
                    padding: 10,
                  }}
                >
                  <Ionicons
                    name={
                      favoritos.includes(String(item.id))
                        ? 'star'
                        : 'star-outline'
                    }
                    size={24}
                    color="#facc15"
                  />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      {/* ==========================================================
          MENU INFERIOR
      ========================================================== */}

      <BottomTabBar usuario={usuario} />
    </View>
  );
}