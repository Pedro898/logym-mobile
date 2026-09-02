import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  alternarFavoritoNoBanco,
  avaliacaoEstaSuspensa,
  avaliacaoPertenceAoUsuario,
  buscarAcademiaPorId,
  buscarAvaliacoesDaAcademia,
  buscarFavoritosDoUsuario,
  buscarFotosAcademia,
  buscarItensAvaliacao,
  buscarUsuarioAutenticado,
  criarAvaliacao,
  extrairIdsAcademiasFavoritas,
  getFotoAcademiaUrl,
  getNomeUsuarioAvaliacao,
  getNotaItemAvaliacao,
  inativarAvaliacao,
  montarItensAvaliacaoParaEnvio,
  normalizarCategorias,
  normalizarFacilidades,
  todosItensAvaliados,

  type Academia,
  type Avaliacao,
  type FotoAcademia,
  type ItemAvaliacao,
  type Usuario,
} from '@/lib/api';
import { ehUsuarioComum } from '@/lib/permissoes';

// ================================================================
// FOTO DA GALERIA
//
// Guardamos a URL pronta no estado.
//
// Isso é importante porque getFotoAcademiaUrl() adiciona Date.now()
// para evitar cache de fotos antigas.
//
// Se chamássemos getFotoAcademiaUrl() diretamente dentro do JSX,
// cada renderização poderia gerar uma URL diferente.
// ================================================================

type FotoGaleria = {
  id: string | number;
  url: string;
};

// ================================================================
// PRIMEIRA LETRA DA ACADEMIA
// ================================================================

function getInicialAcademia(nome?: string) {
  const nomeLimpo = String(nome || 'A').trim();

  if (!nomeLimpo) {
    return 'A';
  }

  return nomeLimpo
    .charAt(0)
    .toUpperCase();
}

// ================================================================
// FALLBACK QUANDO NÃO EXISTE FOTO
// ================================================================

function AcademiaSemFotoGrande({
  nome,
}: {
  nome?: string;
}) {
  return (
    <LinearGradient
      colors={[
        '#1a0700',
        '#f97316',
      ]}
      start={{
        x: 0,
        y: 0,
      }}
      end={{
        x: 1,
        y: 1,
      }}
      style={{
        width: 320,
        height: 220,

        alignSelf: 'center',

        borderRadius: 25,

        marginTop: 10,

        alignItems: 'center',
        justifyContent: 'center',

        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: 86,
          height: 86,

          borderRadius: 43,

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

            fontSize: 44,

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
// TELA
// ================================================================

export default function Detalhes() {
  const router = useRouter();

  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  // ==============================================================
  // USUÁRIO
  // ==============================================================

  const [
    usuario,
    setUsuario,
  ] =
    useState<Usuario | null>(
      null
    );

  // ==============================================================
  // ACADEMIA
  // ==============================================================

  const [
    academia,
    setAcademia,
  ] =
    useState<Academia | null>(
      null
    );

  // ==============================================================
  // GALERIA DE FOTOS
  //
  // Antes tínhamos apenas:
  //
  // const [fotoUrl, setFotoUrl] = ...
  //
  // Agora guardamos TODAS as fotos.
  // ==============================================================

  const [
    fotosAcademia,
    setFotosAcademia,
  ] = useState<
    FotoGaleria[]
  >([]);

  // Foto atualmente selecionada.
  const [
    fotoAtualIndex,
    setFotoAtualIndex,
  ] = useState(0);

  // ==============================================================
  // FAVORITOS
  // ==============================================================

  const [
    favoritos,
    setFavoritos,
  ] =
    useState<string[]>([]);

  // ==============================================================
  // AVALIAÇÕES
  // ==============================================================

  const [
    avaliacoes,
    setAvaliacoes,
  ] =
    useState<Avaliacao[]>([]);

  // ==============================================================
  // CRITÉRIOS DE AVALIAÇÃO
  // ==============================================================

  const [
    itensAvaliacao,
    setItensAvaliacao,
  ] = useState<
    ItemAvaliacao[]
  >([]);

  // ==============================================================
  // NOTAS SELECIONADAS
  //
  // Exemplo:
  //
  // {
  //   "1": 5,
  //   "2": 4
  // }
  // ==============================================================

  const [
    notasSelecionadas,
    setNotasSelecionadas,
  ] = useState<
    Record<string, number>
  >({});

  // ==============================================================
  // EDIÇÃO
  // ==============================================================

  const [
    editandoAvaliacao,
    setEditandoAvaliacao,
  ] = useState(false);

  // ==============================================================
  // CARREGAMENTOS
  // ==============================================================

  const [
    enviandoAvaliacao,
    setEnviandoAvaliacao,
  ] = useState(false);

  const [
    excluindoAvaliacao,
    setExcluindoAvaliacao,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState('');

  // ==============================================================
  // AVALIAÇÕES INATIVADAS LOCALMENTE
  // ==============================================================

  const [
    idsAvaliacoesInativadas,
    setIdsAvaliacoesInativadas,
  ] = useState<string[]>(
    []
  );

  // ==============================================================
  // FOTO ATUAL DA GALERIA
  // ==============================================================

  const fotoAtual =
    fotosAcademia[
      fotoAtualIndex
    ] || null;

  // ==============================================================
  // EXISTE MAIS DE UMA FOTO?
  // ==============================================================

  const possuiVariasFotos =
    fotosAcademia.length > 1;

  // ==============================================================
  // FOTO ANTERIOR
  //
  // Fazemos a galeria circular:
  //
  // foto 1
  // ←
  // vai para a última
  // ==============================================================

  function fotoAnterior() {
    if (
      fotosAcademia.length <= 1
    ) {
      return;
    }

    setFotoAtualIndex(
      (indiceAtual) => {
        if (
          indiceAtual === 0
        ) {
          return (
            fotosAcademia.length -
            1
          );
        }

        return (
          indiceAtual - 1
        );
      }
    );
  }

  // ==============================================================
  // PRÓXIMA FOTO
  //
  // Também é circular:
  //
  // última foto
  // →
  // volta para a primeira
  // ==============================================================

  function proximaFoto() {
    if (
      fotosAcademia.length <= 1
    ) {
      return;
    }

    setFotoAtualIndex(
      (indiceAtual) => {
        if (
          indiceAtual ===
          fotosAcademia.length -
            1
        ) {
          return 0;
        }

        return (
          indiceAtual + 1
        );
      }
    );
  }

  // ==============================================================
  // AVALIAÇÕES VISÍVEIS
  // ==============================================================

  const avaliacoesAtivas =
    useMemo(() => {
      return avaliacoes.filter(
        (avaliacao) => {
          const status =
            String(
              avaliacao.statusAvaliacao ||
                'ATIVO'
            ).toUpperCase();

          const foiInativadaLocalmente =
            idsAvaliacoesInativadas.includes(
              String(
                avaliacao.id
              )
            );

          return (
            status !==
              'INATIVO' &&
            !foiInativadaLocalmente
          );
        }
      );
    }, [
      avaliacoes,
      idsAvaliacoesInativadas,
    ]);

  // ==============================================================
  // MINHA AVALIAÇÃO
  // ==============================================================

  const minhaAvaliacao =
    useMemo(() => {
      if (!usuario?.id) {
        return null;
      }

      return (
        avaliacoesAtivas.find(
          (avaliacao) =>
            avaliacaoPertenceAoUsuario(
              avaliacao,
              usuario.id
            )
        ) || null
      );
    }, [
      avaliacoesAtivas,
      usuario?.id,
    ]);

  // ==============================================================
  // MINHA AVALIAÇÃO ESTÁ SUSPENSA?
  // ==============================================================

  const minhaAvaliacaoSuspensa =
    avaliacaoEstaSuspensa(
      minhaAvaliacao
    );

  // ==============================================================
  // MOSTRAR FORMULÁRIO
  // ==============================================================

  const deveMostrarFormularioAvaliacao =
    ehUsuarioComum(usuario) &&
    (!minhaAvaliacao ||
      editandoAvaliacao) &&
    !minhaAvaliacaoSuspensa;

  // ==============================================================
  // BUSCAR AVALIAÇÕES
  // ==============================================================

  async function carregarAvaliacoes(
    academiaId:
      | string
      | number,

    usuarioId?:
      | string
      | number
  ) {
    try {
      const avaliacoesBanco =
        await buscarAvaliacoesDaAcademia(
          academiaId,
          usuarioId
        );

      setAvaliacoes(
        Array.isArray(
          avaliacoesBanco
        )
          ? avaliacoesBanco
          : []
      );
    } catch (error) {
      console.error(
        'Erro ao buscar avaliações:',
        error
      );

      setAvaliacoes([]);
    }
  }

  // ==============================================================
  // BUSCAR CRITÉRIOS
  // ==============================================================

  async function carregarItensAvaliacao() {
    try {
      const itens =
        await buscarItensAvaliacao();

      setItensAvaliacao(
        Array.isArray(itens)
          ? itens
          : []
      );
    } catch (error) {
      console.error(
        'Erro ao carregar critérios de avaliação:',
        error
      );

      setItensAvaliacao([]);
    }
  }

  // ==============================================================
  // BUSCAR TODAS AS FOTOS DA ACADEMIA
  // ==============================================================

  async function carregarFotosAcademia(
    academiaId:
      | string
      | number
  ) {
    try {
      const fotosBanco =
        await buscarFotosAcademia(
          academiaId
        );

      if (
        !Array.isArray(
          fotosBanco
        ) ||
        fotosBanco.length === 0
      ) {
        setFotosAcademia(
          []
        );

        setFotoAtualIndex(
          0
        );

        return;
      }

      // ==========================================================
      // FILTRAMOS FOTOS INATIVAS CASO O BACKEND AS RETORNE
      //
      // Se statusFotoAcademia não vier no objeto, mantemos a foto.
      // ==========================================================

      const fotosDisponiveis =
        fotosBanco.filter(
          (
            foto: FotoAcademia
          ) => {
            if (
              !foto.statusFotoAcademia
            ) {
              return true;
            }

            return (
              String(
                foto.statusFotoAcademia
              ).toUpperCase() !==
              'INATIVO'
            );
          }
        );

      // ==========================================================
      // MONTA AS URLS UMA ÚNICA VEZ
      //
      // Assim elas permanecem estáveis durante a renderização.
      // ==========================================================

      const galeria =
        fotosDisponiveis
          .map(
            (
              foto: FotoAcademia
            ) => {
              const url =
                getFotoAcademiaUrl(
                  foto.id
                );

              if (!url) {
                return null;
              }

              return {
                id: foto.id,
                url,
              };
            }
          )
          .filter(
            (
              foto
            ): foto is FotoGaleria =>
              foto !== null
          );

      setFotosAcademia(
        galeria
      );

      // Sempre inicia pela primeira.
      setFotoAtualIndex(
        0
      );
    } catch (error) {
      console.error(
        'Erro ao carregar fotos da academia:',
        error
      );

      setFotosAcademia(
        []
      );

      setFotoAtualIndex(
        0
      );
    }
  }

  // ==============================================================
  // CARREGA A TELA
  // ==============================================================

  useEffect(() => {
    async function carregarDetalhes() {
      try {
        setCarregando(true);

        setErro('');

        // ========================================================
        // USUÁRIO AUTENTICADO
        //
        // Validamos a sessão real antes de carregar favoritos e
        // avaliações. Isso mantém o Mobile consistente após F5.
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
        // ID DA ACADEMIA
        // ========================================================

        if (!id) {
          setErro(
            'Academia não encontrada.'
          );

          return;
        }

        // ========================================================
        // ACADEMIA
        // ========================================================

        const academiaBanco =
          await buscarAcademiaPorId(
            id
          );

        setAcademia(
          academiaBanco
        );

        // ========================================================
        // FAVORITOS
        // ========================================================

        if (
          usuarioLogado?.id &&
          ehUsuarioComum(usuarioLogado)
        ) {
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

            setFavoritos(
              []
            );
          }
        } else {
          setFavoritos([]);
        }

        // ========================================================
        // AVALIAÇÕES + CRITÉRIOS + TODAS AS FOTOS
        // ========================================================

        await Promise.all([
          carregarAvaliacoes(
            id,
            usuarioLogado?.id
          ),

          carregarItensAvaliacao(),

          carregarFotosAcademia(
            id
          ),
        ]);
      } catch (error) {
        console.error(
          'Erro ao carregar detalhes:',
          error
        );

        setErro(
          'Erro ao carregar os detalhes da academia.'
        );
      } finally {
        setCarregando(
          false
        );
      }
    }

    carregarDetalhes();
  }, [id]);

  // ==============================================================
  // FAVORITAR
  // ==============================================================

  async function favoritarAcademia() {
    if (
      !academia ||
      !usuario?.id ||
      !ehUsuarioComum(usuario)
    ) {
      return;
    }

    const academiaId =
      String(
        academia.id
      );

    const favoritosAnteriores =
      favoritos;

    const novosFavoritos =
      favoritos.includes(
        academiaId
      )
        ? favoritos.filter(
            (
              favoritoId
            ) =>
              favoritoId !==
              academiaId
          )
        : [
            ...favoritos,
            academiaId,
          ];

    setFavoritos(
      novosFavoritos
    );

    try {
      await alternarFavoritoNoBanco(
        usuario.id,
        academia.id
      );
    } catch (error) {
      console.error(
        'Erro ao atualizar favorito:',
        error
      );

      setFavoritos(
        favoritosAnteriores
      );
    }
  }

  // ==============================================================
  // SELECIONAR NOTA
  // ==============================================================

  function selecionarNota(
    itemId:
      | string
      | number,

    nota: number
  ) {
    setNotasSelecionadas(
      (
        notasAtuais
      ) => ({
        ...notasAtuais,

        [String(
          itemId
        )]: nota,
      })
    );
  }

  // ==============================================================
  // INICIAR EDIÇÃO DA AVALIAÇÃO
  // ==============================================================

  function iniciarEdicaoAvaliacao(
    avaliacao: Avaliacao
  ) {
    if (!ehUsuarioComum(usuario)) {
      return;
    }

    if (
      avaliacaoEstaSuspensa(
        avaliacao
      )
    ) {
      Alert.alert(
        'Avaliação suspensa',
        'Esta avaliação foi suspensa e não pode ser editada.'
      );

      return;
    }

    const notasExistentes:
      Record<
        string,
        number
      > = {};

    itensAvaliacao.forEach(
      (item) => {
        notasExistentes[
          String(item.id)
        ] =
          getNotaItemAvaliacao(
            avaliacao,
            item.id
          );
      }
    );

    setNotasSelecionadas(
      notasExistentes
    );

    setEditandoAvaliacao(
      true
    );
  }

  // ==============================================================
  // CANCELAR EDIÇÃO
  // ==============================================================

  function cancelarEdicaoAvaliacao() {
    setNotasSelecionadas(
      {}
    );

    setEditandoAvaliacao(
      false
    );
  }

  // ==============================================================
  // ENVIAR AVALIAÇÃO
  // ==============================================================

  async function enviarAvaliacao() {
    if (!ehUsuarioComum(usuario)) {
      Alert.alert(
        'Ação não disponível',
        'Gerentes e administradores podem consultar as avaliações, mas não podem avaliar academias.'
      );
      return;
    }

    if (
      !academia ||
      !usuario?.id
    ) {
      Alert.alert(
        'Atenção',
        'Usuário não encontrado. Faça login novamente.'
      );

      return;
    }

    // ============================================================
    // ACADEMIA SUSPENSA
    // ============================================================

    if (
      String(
        academia.statusAcademia ||
          ''
      ).toUpperCase() ===
      'SUSPENSA'
    ) {
      Alert.alert(
        'Academia suspensa',
        'Não é possível avaliar uma academia suspensa.'
      );

      return;
    }

    // ============================================================
    // SEM CRITÉRIOS
    // ============================================================

    if (
      itensAvaliacao.length ===
      0
    ) {
      Alert.alert(
        'Atenção',
        'Nenhum critério de avaliação está disponível no momento.'
      );

      return;
    }

    // ============================================================
    // TODOS PRECISAM SER AVALIADOS
    // ============================================================

    if (
      !todosItensAvaliados(
        itensAvaliacao,
        notasSelecionadas
      )
    ) {
      Alert.alert(
        'Atenção',
        'Avalie todos os critérios antes de enviar.'
      );

      return;
    }

    try {
      setEnviandoAvaliacao(
        true
      );

      const itensParaEnvio =
        montarItensAvaliacaoParaEnvio(
          itensAvaliacao,
          notasSelecionadas
        );

      await criarAvaliacao(
        usuario.id,
        academia.id,
        {
          itens:
            itensParaEnvio,
        }
      );

      setIdsAvaliacoesInativadas(
        []
      );

      setNotasSelecionadas(
        {}
      );

      const estavaEditando =
        editandoAvaliacao;

      setEditandoAvaliacao(
        false
      );

      await carregarAvaliacoes(
        academia.id,
        usuario.id
      );

      Alert.alert(
        'Sucesso',

        estavaEditando
          ? 'Avaliação atualizada com sucesso.'
          : 'Avaliação enviada com sucesso.'
      );
    } catch (error) {
      console.error(
        'Erro ao enviar avaliação:',
        error
      );

      if (
        error instanceof
        Error
      ) {
        Alert.alert(
          'Erro',
          error.message
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível enviar sua avaliação.'
        );
      }
    } finally {
      setEnviandoAvaliacao(
        false
      );
    }
  }

  // ==============================================================
  // EXECUTA A EXCLUSÃO
  // ==============================================================

  async function executarExclusaoAvaliacao() {
    if (
      !usuario?.id ||
      !minhaAvaliacao ||
      !academia
    ) {
      Alert.alert(
        'Erro',
        'Não foi possível identificar sua avaliação.'
      );

      return;
    }

    if (
      avaliacaoEstaSuspensa(
        minhaAvaliacao
      )
    ) {
      Alert.alert(
        'Avaliação suspensa',
        'Uma avaliação suspensa não pode ser excluída pelo usuário.'
      );

      return;
    }

    try {
      setExcluindoAvaliacao(
        true
      );

      const idAvaliacaoExcluida =
        String(
          minhaAvaliacao.id
        );

      await inativarAvaliacao(
        minhaAvaliacao.id,
        usuario.id
      );

      setAvaliacoes(
        (
          listaAtual
        ) =>
          listaAtual.filter(
            (
              avaliacao
            ) =>
              String(
                avaliacao.id
              ) !==
              idAvaliacaoExcluida
          )
      );

      setIdsAvaliacoesInativadas(
        (
          listaAtual
        ) => [
          ...listaAtual,
          idAvaliacaoExcluida,
        ]
      );

      setNotasSelecionadas(
        {}
      );

      setEditandoAvaliacao(
        false
      );

      await carregarAvaliacoes(
        academia.id,
        usuario.id
      );

      Alert.alert(
        'Sucesso',
        'Avaliação excluída com sucesso.'
      );
    } catch (error) {
      console.error(
        'Erro ao excluir avaliação:',
        error
      );

      if (
        error instanceof
        Error
      ) {
        Alert.alert(
          'Erro',
          error.message
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível excluir sua avaliação.'
        );
      }
    } finally {
      setExcluindoAvaliacao(
        false
      );
    }
  }

  // ==============================================================
  // CONFIRMAÇÃO DE EXCLUSÃO
  // ==============================================================

  function excluirMinhaAvaliacao() {
    if (!ehUsuarioComum(usuario)) {
      return;
    }

    if (
      !usuario?.id ||
      !minhaAvaliacao ||
      !academia
    ) {
      Alert.alert(
        'Erro',
        'Não foi possível identificar sua avaliação.'
      );

      return;
    }

    if (
      avaliacaoEstaSuspensa(
        minhaAvaliacao
      )
    ) {
      Alert.alert(
        'Avaliação suspensa',
        'Uma avaliação suspensa não pode ser excluída pelo usuário.'
      );

      return;
    }

    // ============================================================
    // WEB
    // ============================================================

    if (
      Platform.OS ===
      'web'
    ) {
      const confirmou =
        window.confirm(
          'Tem certeza que deseja excluir sua avaliação?'
        );

      if (confirmou) {
        executarExclusaoAvaliacao();
      }

      return;
    }

    // ============================================================
    // ANDROID / IOS
    // ============================================================

    Alert.alert(
      'Excluir avaliação',

      'Tem certeza que deseja excluir sua avaliação?',

      [
        {
          text:
            'Cancelar',

          style:
            'cancel',
        },

        {
          text:
            'Excluir',

          style:
            'destructive',

          onPress:
            executarExclusaoAvaliacao,
        },
      ]
    );
  }

  // ==============================================================
  // CARREGANDO
  // ==============================================================

  if (carregando) {
    return (
      <View
        style={{
          flex: 1,

          backgroundColor:
            '#000',

          justifyContent:
            'center',

          alignItems:
            'center',

          padding: 20,
        }}
      >
        <ActivityIndicator
          color="#f97316"
        />

        <Text
          style={{
            color: '#fff',

            marginTop: 12,

            textAlign:
              'center',
          }}
        >
          Carregando detalhes da academia...
        </Text>
      </View>
    );
  }

  // ==============================================================
  // ERRO
  // ==============================================================

  if (
    erro ||
    !academia
  ) {
    return (
      <View
        style={{
          flex: 1,

          backgroundColor:
            '#000',

          justifyContent:
            'center',

          alignItems:
            'center',

          padding: 20,
        }}
      >
        <Text
          style={{
            color:
              '#ffb4b4',

            fontSize: 16,

            textAlign:
              'center',

            marginBottom: 20,
          }}
        >
          {erro ||
            'Academia não encontrada.'}
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.replace(
              '/academias'
            )
          }
          style={{
            backgroundColor:
              '#f97316',

            paddingVertical:
              12,

            paddingHorizontal:
              22,

            borderRadius:
              14,
          }}
        >
          <Text
            style={{
              color: '#fff',

              fontWeight:
                'bold',
            }}
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==============================================================
  // ACADEMIA SUSPENSA
  // ==============================================================

  if (
    String(
      academia.statusAcademia ||
        ''
    ).toUpperCase() ===
    'SUSPENSA'
  ) {
    return (
      <View
        style={{
          flex: 1,

          backgroundColor:
            '#000',

          paddingTop: 20,

          paddingHorizontal:
            20,
        }}
      >
        {/* ========================================================
            VOLTAR
        ======================================================== */}

        <TouchableOpacity
          onPress={() =>
            router.replace(
              '/academias'
            )
          }
          style={{
            alignSelf:
              'flex-start',

            marginBottom: 35,
          }}
        >
          <Ionicons
            name="arrow-back"
            size={32}
            color="#f97316"
          />
        </TouchableOpacity>

        {/* ========================================================
            AVISO
        ======================================================== */}

        <View
          style={{
            backgroundColor:
              '#160b06',

            borderRadius: 22,

            borderWidth: 1,

            borderColor:
              '#f97316',

            paddingVertical:
              28,

            paddingHorizontal:
              22,
          }}
        >
          <View
            style={{
              width: 62,

              height: 62,

              borderRadius: 31,

              backgroundColor:
                '#2a1208',

              alignItems:
                'center',

              justifyContent:
                'center',

              alignSelf:
                'center',

              marginBottom: 18,
            }}
          >
            <Ionicons
              name="alert-circle-outline"
              size={38}
              color="#f97316"
            />
          </View>

          <Text
            style={{
              color:
                '#f97316',

              fontSize: 24,

              fontWeight:
                'bold',

              textAlign:
                'center',

              marginBottom:
                14,
            }}
          >
            Academia suspensa
          </Text>

          <Text
            style={{
              color: '#fff',

              fontSize: 16,

              textAlign:
                'center',

              lineHeight: 23,
            }}
          >
            Esta academia foi suspensa pela administração da LOGYM.
            Ela não está disponível para usuários comuns no momento.
          </Text>

          <Text
            style={{
              color: '#aaa',

              fontSize: 15,

              textAlign:
                'center',

              lineHeight: 22,

              marginTop: 14,
            }}
          >
            Para mais informações, entre em contato com o suporte.
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.replace(
                '/academias'
              )
            }
            style={{
              backgroundColor:
                '#f97316',

              paddingVertical:
                14,

              borderRadius:
                14,

              alignItems:
                'center',

              marginTop: 24,
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
              Voltar para academias
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==============================================================
  // ID DA ACADEMIA
  // ==============================================================

  const academiaId =
    String(
      academia.id
    );

  // ==============================================================
  // CATEGORIAS
  // ==============================================================

  const categorias =
    academia
      .categoriasVinculadas &&
    academia
      .categoriasVinculadas
      .length > 0
      ? academia.categoriasVinculadas.map(
          (
            categoria
          ) =>
            categoria.nome
        )
      : normalizarCategorias(
          academia.categorias
        );

  // ==============================================================
  // FACILIDADES
  // ==============================================================

  const facilidades =
    academia
      .facilidadesVinculadas &&
    academia
      .facilidadesVinculadas
      .length > 0
      ? academia.facilidadesVinculadas.map(
          (
            facilidade
          ) =>
            facilidade.nome
        )
      : normalizarFacilidades(
          academia.facilidades
        );

  // ==============================================================
  // INTERFACE
  // ==============================================================

  return (
    <ScrollView
      style={{
        flex: 1,

        backgroundColor:
          '#000',
      }}
      contentContainerStyle={{
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={
        false
      }
    >
      {/* ==========================================================
          VOLTAR
      ========================================================== */}

      <TouchableOpacity
        onPress={() =>
          router.replace(
            '/academias'
          )
        }
        style={{
          marginTop: 20,

          marginLeft: 20,
        }}
      >
        <Ionicons
          name="arrow-back"
          size={32}
          color="#f97316"
        />
      </TouchableOpacity>

      {/* ==========================================================
          GALERIA DE FOTOS
      ========================================================== */}

      {fotoAtual ? (
        <View
          style={{
            marginTop: 10,
          }}
        >
          {/* ======================================================
              FOTO PRINCIPAL
          ====================================================== */}

          <View
            style={{
              width: 320,
              height: 220,

              alignSelf:
                'center',

              position:
                'relative',

              borderRadius:
                25,

              overflow:
                'hidden',

              backgroundColor:
                '#111',
            }}
          >
            <Image
              source={{
                uri:
                  fotoAtual.url,
              }}
              style={{
                width:
                  '100%',

                height:
                  '100%',

                backgroundColor:
                  '#111',
              }}
              resizeMode="cover"
            />

            {/* ====================================================
                SETA ESQUERDA
            ==================================================== */}

            {possuiVariasFotos ? (
              <TouchableOpacity
                onPress={
                  fotoAnterior
                }
                style={{
                  position:
                    'absolute',

                  left: 10,

                  top: '50%',

                  marginTop:
                    -22,

                  width: 44,

                  height: 44,

                  borderRadius:
                    22,

                  backgroundColor:
                    'rgba(0,0,0,0.65)',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={30}
                  color="#fff"
                />
              </TouchableOpacity>
            ) : null}

            {/* ====================================================
                SETA DIREITA
            ==================================================== */}

            {possuiVariasFotos ? (
              <TouchableOpacity
                onPress={
                  proximaFoto
                }
                style={{
                  position:
                    'absolute',

                  right: 10,

                  top: '50%',

                  marginTop:
                    -22,

                  width: 44,

                  height: 44,

                  borderRadius:
                    22,

                  backgroundColor:
                    'rgba(0,0,0,0.65)',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={30}
                  color="#fff"
                />
              </TouchableOpacity>
            ) : null}

            {/* ====================================================
                CONTADOR
            ==================================================== */}

            {possuiVariasFotos ? (
              <View
                style={{
                  position:
                    'absolute',

                  right: 12,

                  bottom: 12,

                  backgroundColor:
                    'rgba(0,0,0,0.75)',

                  paddingHorizontal:
                    10,

                  paddingVertical:
                    5,

                  borderRadius:
                    12,
                }}
              >
                <Text
                  style={{
                    color: '#fff',

                    fontSize: 13,

                    fontWeight:
                      'bold',
                  }}
                >
                  {fotoAtualIndex +
                    1}{' '}
                  /{' '}
                  {
                    fotosAcademia.length
                  }
                </Text>
              </View>
            ) : null}
          </View>

          {/* ======================================================
              MINIATURAS
          //
              Só aparecem quando há mais de uma foto.
          ====================================================== */}

          {possuiVariasFotos ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={{
                paddingHorizontal:
                  20,

                paddingTop: 12,

                gap: 9,
              }}
            >
              {fotosAcademia.map(
                (
                  foto,
                  index
                ) => {
                  const selecionada =
                    index ===
                    fotoAtualIndex;

                  return (
                    <TouchableOpacity
                      key={String(
                        foto.id
                      )}
                      onPress={() =>
                        setFotoAtualIndex(
                          index
                        )
                      }
                      style={{
                        borderRadius:
                          12,

                        borderWidth:
                          selecionada
                            ? 2
                            : 1,

                        borderColor:
                          selecionada
                            ? '#f97316'
                            : '#333',

                        padding: 2,
                      }}
                    >
                      <Image
                        source={{
                          uri:
                            foto.url,
                        }}
                        style={{
                          width: 64,

                          height: 52,

                          borderRadius:
                            8,

                          opacity:
                            selecionada
                              ? 1
                              : 0.6,

                          backgroundColor:
                            '#111',
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>
          ) : null}
        </View>
      ) : (
        <AcademiaSemFotoGrande
          nome={
            academia.nome
          }
        />
      )}

      {/* ==========================================================
          CONTEÚDO
      ========================================================== */}

      <View
        style={{
          backgroundColor:
            '#111',

          marginTop: 25,

          borderTopLeftRadius:
            35,

          borderTopRightRadius:
            35,

          padding: 25,

          minHeight: 600,

          borderTopWidth: 3,

          borderColor:
            '#f97316',
        }}
      >
        {/* ========================================================
            NOME + FAVORITO
        ======================================================== */}

        <View
          style={{
            flexDirection:
              'row',

            justifyContent:
              'space-between',

            alignItems:
              'center',
          }}
        >
          <Text
            style={{
              color:
                '#f97316',

              fontSize: 24,

              fontWeight:
                'bold',

              flex: 1,

              marginRight: 10,
            }}
          >
            {academia.nome}
          </Text>

          {ehUsuarioComum(usuario) ? (
            <TouchableOpacity
              onPress={favoritarAcademia}
            >
              <Ionicons
                name={
                  favoritos.includes(academiaId)
                    ? 'star'
                    : 'star-outline'
                }
                size={30}
                color="#facc15"
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ========================================================
            NOTA GERAL
        ======================================================== */}

        {academia.nota !==
          null &&
        academia.nota !==
          undefined ? (
          <Text
            style={{
              color: '#fff',

              fontSize: 17,

              marginTop: 10,
            }}
          >
            {Number(
              academia.nota
            ).toFixed(
              1
            )}{' '}
            ⭐
          </Text>
        ) : (
          <Text
            style={{
              color: '#777',

              fontSize: 16,

              marginTop: 10,
            }}
          >
            Sem avaliações
          </Text>
        )}

        {/* ========================================================
            ENDEREÇO
        ======================================================== */}

        <View
          style={{
            flexDirection:
              'row',

            marginTop: 30,
          }}
        >
          <Ionicons
            name="location-sharp"
            size={34}
            color="#f97316"
          />

          <View
            style={{
              marginLeft: 12,

              flex: 1,
            }}
          >
            <Text
              style={{
                color: '#fff',

                fontSize: 17,

                marginBottom: 5,
              }}
            >
              {academia.endereco}

              {academia.numero
                ? `, ${academia.numero}`
                : ''}
            </Text>

            {academia.complemento ? (
              <Text
                style={{
                  color: '#ccc',

                  fontSize: 16,

                  marginBottom:
                    5,
                }}
              >
                {
                  academia.complemento
                }
              </Text>
            ) : null}

            <Text
              style={{
                color: '#fff',

                fontSize: 17,

                marginBottom: 5,
              }}
            >
              {academia.bairro
                ? `${academia.bairro} - `
                : ''}

              {academia.cidade}

              {academia.estado
                ? `, ${academia.estado}`
                : ''}
            </Text>

            <Text
              style={{
                color:
                  '#f97316',

                fontSize: 17,
              }}
            >
              CEP: {academia.cep}
            </Text>
          </View>
        </View>

        {/* ========================================================
            DESCRIÇÃO
        ======================================================== */}

        {academia.descricao ? (
          <View
            style={{
              marginTop: 35,
            }}
          >
            <Text
              style={{
                color:
                  '#f97316',

                fontSize: 22,

                fontWeight:
                  'bold',

                marginBottom:
                  12,
              }}
            >
              Sobre
            </Text>

            <Text
              style={{
                color: '#ccc',

                fontSize: 16,

                lineHeight: 23,
              }}
            >
              {
                academia.descricao
              }
            </Text>
          </View>
        ) : null}

        {/* ========================================================
            CATEGORIAS
        ======================================================== */}

        <View
          style={{
            marginTop: 35,
          }}
        >
          <Text
            style={{
              color:
                '#f97316',

              fontSize: 22,

              fontWeight:
                'bold',

              marginBottom:
                15,
            }}
          >
            Categorias
          </Text>

          {categorias.length >
          0 ? (
            categorias.map(
              (
                categoria,
                index
              ) => (
                <View
                  key={`${categoria}-${index}`}
                  style={{
                    flexDirection:
                      'row',

                    alignItems:
                      'center',

                    marginBottom:
                      14,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#f97316"
                  />

                  <Text
                    style={{
                      color:
                        '#fff',

                      fontSize:
                        16,

                      marginLeft:
                        10,

                      flex: 1,
                    }}
                  >
                    {categoria}
                  </Text>
                </View>
              )
            )
          ) : (
            <Text
              style={{
                color: '#ccc',

                fontSize: 16,
              }}
            >
              Nenhuma categoria cadastrada.
            </Text>
          )}
        </View>

        {/* ========================================================
            FACILIDADES
        ======================================================== */}

        <View
          style={{
            marginTop: 35,
          }}
        >
          <Text
            style={{
              color:
                '#f97316',

              fontSize: 22,

              fontWeight:
                'bold',

              marginBottom:
                15,
            }}
          >
            Facilidades
          </Text>

          {facilidades.length >
          0 ? (
            facilidades.map(
              (
                facilidade,
                index
              ) => (
                <View
                  key={`${facilidade}-${index}`}
                  style={{
                    flexDirection:
                      'row',

                    alignItems:
                      'center',

                    marginBottom:
                      14,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#f97316"
                  />

                  <Text
                    style={{
                      color:
                        '#fff',

                      fontSize:
                        16,

                      marginLeft:
                        10,

                      flex: 1,
                    }}
                  >
                    {facilidade}
                  </Text>
                </View>
              )
            )
          ) : (
            <Text
              style={{
                color: '#ccc',

                fontSize: 16,
              }}
            >
              Nenhuma facilidade cadastrada.
            </Text>
          )}
        </View>

        {/* ========================================================
            AVALIAÇÕES
        ======================================================== */}

        <View
          style={{
            marginTop: 40,
          }}
        >
          <Text
            style={{
              color:
                '#f97316',

              fontSize: 22,

              fontWeight:
                'bold',

              marginBottom:
                15,
            }}
          >
            Avaliações
          </Text>

          {/* ======================================================
              MINHA AVALIAÇÃO SUSPENSA
          ====================================================== */}

          {ehUsuarioComum(usuario) && minhaAvaliacaoSuspensa ? (
            <View
              style={{
                backgroundColor:
                  '#2a0f0f',

                borderWidth: 1,

                borderColor:
                  '#7f1d1d',

                borderRadius:
                  16,

                padding: 14,

                marginBottom:
                  20,
              }}
            >
              <Text
                style={{
                  color:
                    '#ffb4b4',

                  fontWeight:
                    'bold',

                  fontSize: 15,

                  marginBottom: 6,
                }}
              >
                Sua avaliação foi suspensa pela administração.
              </Text>

              <Text
                style={{
                  color: '#ccc',

                  fontSize: 14,

                  lineHeight: 20,
                }}
              >
                Ela não aparece para outros usuários e não conta na média da academia.
              </Text>
            </View>
          ) : null}

          {/* ======================================================
              FORMULÁRIO DE AVALIAÇÃO
          ====================================================== */}

          {deveMostrarFormularioAvaliacao ? (
            <View
              style={{
                backgroundColor:
                  '#000',

                borderRadius:
                  18,

                borderWidth: 1,

                borderColor:
                  '#333',

                padding: 15,

                marginBottom:
                  25,
              }}
            >
              <Text
                style={{
                  color: '#fff',

                  fontSize: 17,

                  fontWeight:
                    'bold',

                  marginBottom:
                    16,
                }}
              >
                {editandoAvaliacao
                  ? 'Editar sua avaliação'
                  : 'Deixe sua avaliação'}
              </Text>

              {/* ==================================================
                  CRITÉRIOS
              ================================================== */}

              {itensAvaliacao.length ===
              0 ? (
                <Text
                  style={{
                    color: '#777',

                    fontSize: 15,
                  }}
                >
                  Nenhum critério de avaliação disponível.
                </Text>
              ) : (
                itensAvaliacao.map(
                  (item) => {
                    const notaAtual =
                      Number(
                        notasSelecionadas[
                          String(
                            item.id
                          )
                        ] || 0
                      );

                    return (
                      <View
                        key={String(
                          item.id
                        )}
                        style={{
                          marginBottom:
                            20,

                          paddingBottom:
                            18,

                          borderBottomWidth:
                            1,

                          borderBottomColor:
                            '#222',
                        }}
                      >
                        <Text
                          style={{
                            color:
                              '#fff',

                            fontSize:
                              16,

                            fontWeight:
                              'bold',

                            marginBottom:
                              5,
                          }}
                        >
                          {
                            item.nome
                          }
                        </Text>

                        {item.descricao ? (
                          <Text
                            style={{
                              color:
                                '#888',

                              fontSize:
                                13,

                              marginBottom:
                                10,

                              lineHeight:
                                18,
                            }}
                          >
                            {
                              item.descricao
                            }
                          </Text>
                        ) : null}

                        <View
                          style={{
                            flexDirection:
                              'row',
                          }}
                        >
                          {[
                            1,
                            2,
                            3,
                            4,
                            5,
                          ].map(
                            (
                              nota
                            ) => (
                              <TouchableOpacity
                                key={
                                  nota
                                }
                                onPress={() =>
                                  selecionarNota(
                                    item.id,
                                    nota
                                  )
                                }
                                style={{
                                  marginRight:
                                    7,
                                }}
                              >
                                <Ionicons
                                  name={
                                    nota <=
                                    notaAtual
                                      ? 'star'
                                      : 'star-outline'
                                  }
                                  size={
                                    31
                                  }
                                  color="#facc15"
                                />
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </View>
                    );
                  }
                )
              )}

              {/* ==================================================
                  SALVAR
              ================================================== */}

              <TouchableOpacity
                onPress={
                  enviarAvaliacao
                }
                disabled={
                  enviandoAvaliacao ||
                  itensAvaliacao.length ===
                    0
                }
                style={{
                  backgroundColor:
                    enviandoAvaliacao ||
                    itensAvaliacao.length ===
                      0
                      ? '#9a4b12'
                      : '#f97316',

                  paddingVertical:
                    13,

                  borderRadius:
                    15,

                  alignItems:
                    'center',

                  marginBottom:
                    editandoAvaliacao
                      ? 10
                      : 0,

                  opacity:
                    itensAvaliacao.length ===
                    0
                      ? 0.6
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
                  {enviandoAvaliacao
                    ? 'Salvando...'
                    : editandoAvaliacao
                      ? 'Salvar edição'
                      : 'Enviar avaliação'}
                </Text>
              </TouchableOpacity>

              {/* ==================================================
                  CANCELAR
              ================================================== */}

              {editandoAvaliacao ? (
                <TouchableOpacity
                  onPress={
                    cancelarEdicaoAvaliacao
                  }
                  disabled={
                    enviandoAvaliacao
                  }
                  style={{
                    backgroundColor:
                      '#111',

                    paddingVertical:
                      13,

                    borderRadius:
                      15,

                    alignItems:
                      'center',

                    borderWidth:
                      1,

                    borderColor:
                      '#333',
                  }}
                >
                  <Text
                    style={{
                      color:
                        '#ccc',

                      fontWeight:
                        'bold',

                      fontSize:
                        16,
                    }}
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* ======================================================
              JÁ AVALIOU
          ====================================================== */}

          {ehUsuarioComum(usuario) &&
          minhaAvaliacao &&
          !editandoAvaliacao &&
          !minhaAvaliacaoSuspensa ? (
            <Text
              style={{
                color: '#ccc',

                fontSize: 14,

                marginBottom:
                  14,
              }}
            >
              Você já avaliou esta academia. Use Editar ou Excluir na sua avaliação.
            </Text>
          ) : null}

          {/* ======================================================
              SEM AVALIAÇÕES
          ====================================================== */}

          {avaliacoesAtivas.length ===
          0 ? (
            <Text
              style={{
                color: '#ccc',

                fontSize: 16,
              }}
            >
              Essa academia ainda não possui avaliações.
            </Text>
          ) : (
            // ====================================================
            // LISTA DAS AVALIAÇÕES
            // ====================================================

            avaliacoesAtivas.map(
              (
                avaliacao
              ) => {
                const pertenceAoUsuario =
                  avaliacaoPertenceAoUsuario(
                    avaliacao,
                    usuario?.id
                  );

                const suspensa =
                  avaliacaoEstaSuspensa(
                    avaliacao
                  );

                return (
                  <View
                    key={String(
                      avaliacao.id
                    )}
                    style={{
                      backgroundColor:
                        '#000',

                      borderRadius:
                        18,

                      borderWidth:
                        1,

                      borderColor:
                        suspensa
                          ? '#7f1d1d'
                          : pertenceAoUsuario
                            ? '#f97316'
                            : '#333',

                      padding: 15,

                      marginBottom:
                        15,
                    }}
                  >
                    {/* ============================================
                        NOME + MÉDIA
                    ============================================ */}

                    <View
                      style={{
                        flexDirection:
                          'row',

                        justifyContent:
                          'space-between',

                        alignItems:
                          'center',

                        marginBottom:
                          12,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            '#fff',

                          fontWeight:
                            'bold',

                          fontSize:
                            16,

                          flex: 1,

                          marginRight:
                            10,
                        }}
                      >
                        {getNomeUsuarioAvaliacao(
                          avaliacao
                        )}

                        {pertenceAoUsuario
                          ? ' (você)'
                          : ''}
                      </Text>

                      <Text
                        style={{
                          color:
                            '#facc15',

                          fontWeight:
                            'bold',
                        }}
                      >
                        {Number(
                          avaliacao.nota
                        ).toFixed(
                          1
                        )}{' '}
                        ⭐
                      </Text>
                    </View>

                    {/* ============================================
                        AVALIAÇÃO SUSPENSA
                    ============================================ */}

                    {suspensa ? (
                      <View
                        style={{
                          marginBottom:
                            10,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              '#ffb4b4',

                            fontSize:
                              13,

                            fontWeight:
                              'bold',

                            marginBottom:
                              4,
                          }}
                        >
                          Avaliação suspensa
                        </Text>

                        {pertenceAoUsuario ? (
                          <Text
                            style={{
                              color:
                                '#999',

                              fontSize:
                                12,

                              lineHeight:
                                17,
                            }}
                          >
                            Esta avaliação não aparece para outros usuários e não conta na média.
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {/* ============================================
                        NOTAS POR CRITÉRIO
                    ============================================ */}

                    {Array.isArray(
                      avaliacao.itens
                    ) &&
                    avaliacao.itens.length >
                      0 ? (
                      <View>
                        {avaliacao.itens.map(
                          (
                            item,
                            index
                          ) => (
                            <View
                              key={`${avaliacao.id}-${item.itemId}-${index}`}
                              style={{
                                flexDirection:
                                  'row',

                                justifyContent:
                                  'space-between',

                                alignItems:
                                  'center',

                                paddingVertical:
                                  7,

                                borderBottomWidth:
                                  index <
                                  avaliacao
                                    .itens!
                                    .length -
                                    1
                                    ? 1
                                    : 0,

                                borderBottomColor:
                                  '#222',
                              }}
                            >
                              <Text
                                style={{
                                  color:
                                    '#ccc',

                                  fontSize:
                                    14,

                                  flex: 1,

                                  marginRight:
                                    10,
                                }}
                              >
                                {item.itemNome ||
                                  `Critério ${index + 1}`}
                              </Text>

                              <Text
                                style={{
                                  color:
                                    '#facc15',

                                  fontWeight:
                                    'bold',

                                  fontSize:
                                    14,
                                }}
                              >
                                {Number(
                                  item.nota
                                ).toFixed(
                                  0
                                )}{' '}
                                ⭐
                              </Text>
                            </View>
                          )
                        )}
                      </View>
                    ) : (
                      <Text
                        style={{
                          color:
                            '#777',

                          fontSize:
                            14,
                        }}
                      >
                        Detalhes dos critérios não disponíveis.
                      </Text>
                    )}

                    {/* ============================================
                        EDITAR / EXCLUIR
                    ============================================ */}

                    {ehUsuarioComum(usuario) &&
                    pertenceAoUsuario &&
                    !suspensa ? (
                      <View
                        style={{
                          flexDirection:
                            'row',

                          marginTop:
                            14,

                          gap: 10,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            iniciarEdicaoAvaliacao(
                              avaliacao
                            )
                          }
                          disabled={
                            excluindoAvaliacao
                          }
                          style={{
                            flex: 1,

                            backgroundColor:
                              '#f97316',

                            paddingVertical:
                              11,

                            borderRadius:
                              12,

                            alignItems:
                              'center',
                          }}
                        >
                          <Text
                            style={{
                              color:
                                '#fff',

                              fontWeight:
                                'bold',
                            }}
                          >
                            Editar
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={
                            excluirMinhaAvaliacao
                          }
                          disabled={
                            excluindoAvaliacao
                          }
                          style={{
                            flex: 1,

                            backgroundColor:
                              '#2a0f0f',

                            paddingVertical:
                              11,

                            borderRadius:
                              12,

                            alignItems:
                              'center',

                            borderWidth:
                              1,

                            borderColor:
                              '#7f1d1d',
                          }}
                        >
                          <Text
                            style={{
                              color:
                                '#ffb4b4',

                              fontWeight:
                                'bold',
                            }}
                          >
                            {excluindoAvaliacao
                              ? 'Excluindo...'
                              : 'Excluir'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              }
            )
          )}
        </View>
      </View>
    </ScrollView>
  );
}