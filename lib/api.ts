import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ================================================================
// CATEGORIAS
// ================================================================

export type Categoria = {
  id: string | number;
  nome: string;
  descricao?: string;
  statusCategoria?: string;
};

// ================================================================
// FACILIDADES
// ================================================================

export type Facilidade = {
  id: string | number;
  nome: string;
  descricao?: string;
  statusFacilidade?: string;
};

// ================================================================
// ACADEMIA
// ================================================================

export type Academia = {
  id: string | number;
  nome: string;
  cnpj?: string;
  descricao?: string;

  cep: string;
  endereco: string;
  numero?: number;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado?: string;

  telefone?: string;
  celular?: string;
  email?: string;

  // ==============================================================
  // MODELO ANTIGO
  //
  // Mantido para compatibilidade com registros/respostas antigas.
  // ==============================================================

  categorias?: string;
  facilidades?: string;

  // ==============================================================
  // MODELO NOVO
  //
  // Usado pelo Web/backend atual.
  // ==============================================================

  categoriaIds?: Array<string | number>;
  categoriasVinculadas?: Categoria[];

  facilidadeIds?: Array<string | number>;
  facilidadesVinculadas?: Facilidade[];

  nota?: number | null;
  statusAcademia?: string;
};

// ================================================================
// USUÁRIO
// ================================================================

export type Usuario = {
  id: string | number;
  nome: string;
  username: string;
  nivelAcesso?: string;
  statusUsuario?: string;
  cep?: string;
};

// ================================================================
// STATUS DO LOGIN
// ================================================================

export type StatusLogin = {
  podeLogar: boolean;
  statusUsuario?: string;
  message?: string;
};

// ================================================================
// FOTO DA ACADEMIA
// ================================================================

export type FotoAcademia = {
  id: string | number;

  academiaId?: string | number;

  tipoArquivo?: string;

  dataCadastro?: string;

  // Mantemos por compatibilidade caso uma resposta antiga ainda envie.
  statusFotoAcademia?: string;
};

// ================================================================
// VIACEP
// ================================================================

export type EnderecoViaCep = {
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
};

// ================================================================
// URL DA API
// ================================================================

function removerBarraFinal(url: string) {
  return url.replace(/\/$/, '');
}

function buscarApiUrl() {
  // ==============================================================
  // URL CONFIGURADA MANUALMENTE
  //
  // Se existir EXPO_PUBLIC_API_URL no .env,
  // ela continua tendo prioridade.
  //
  // Exemplo:
  //
  // EXPO_PUBLIC_API_URL=http://192.168.0.10:8080
  // ==============================================================

  if (process.env.EXPO_PUBLIC_API_URL) {
    return removerBarraFinal(
      process.env.EXPO_PUBLIC_API_URL
    );
  }

  // ==============================================================
  // EXPO WEB / MOBILE RODANDO NO NAVEGADOR
  //
  // Aqui está uma parte importante da correção.
  //
  // Antes o Mobile sempre usava:
  //
  // http://localhost:8080
  //
  // Isso fazia o Web normal e o Mobile Web conversarem com
  // exatamente o mesmo host do backend.
  //
  // Consequência:
  //
  // Web:
  // localhost:5173
  //
  // Mobile:
  // localhost:8081
  //
  // Backend dos dois:
  // localhost:8080
  //
  // Como cookies NÃO são separados por porta, os dois acabavam
  // utilizando o mesmo cookie JSESSIONID do Spring.
  //
  // Agora usamos o mesmo hostname pelo qual o Mobile foi aberto.
  //
  // Se o Mobile foi aberto por:
  //
  // http://127.0.0.1:8081
  //
  // então a API será:
  //
  // http://127.0.0.1:8080
  //
  // O Web normal pode continuar usando:
  //
  // http://localhost:8080
  //
  // Como localhost e 127.0.0.1 são hosts diferentes para cookies,
  // as sessões ficam separadas.
  // ==============================================================

  if (Platform.OS === 'web') {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.hostname
    ) {
      const hostname =
        window.location.hostname;

      return `http://${hostname}:8080`;
    }

    // Fallback do Expo Web.
    return 'http://127.0.0.1:8080';
  }

  // ==============================================================
  // DISPOSITIVO FÍSICO / EXPO GO
  //
  // Mantemos exatamente a lógica que já estava funcionando.
  // ==============================================================

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  const host =
    hostUri?.split(':')[0];

  if (
    host &&
    host !== 'localhost' &&
    host !== '127.0.0.1'
  ) {
    return `http://${host}:8080`;
  }

  // ==============================================================
  // EMULADOR ANDROID
  //
  // No Android Emulator, 10.0.2.2 representa o localhost
  // do computador.
  // ==============================================================

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080';
  }

  // ==============================================================
  // FALLBACK
  // ==============================================================

  return 'http://localhost:8080';
}

export const API_URL = buscarApiUrl();

const REQUEST_TIMEOUT_MS = 10000;

// ================================================================
// LÊ A MENSAGEM DE ERRO DO BACKEND
//
// O Spring pode retornar:
//
// {
//   "message": "E-mail ou senha inválidos."
// }
//
// ou simplesmente texto.
//
// Esta função trata os dois casos.
// ================================================================

async function extrairMensagemResposta(
  resposta: Response
) {
  const texto = await resposta.text();

  if (!texto) {
    return '';
  }

  try {
    const json = JSON.parse(texto);

    return (
      json?.message ||
      json?.mensagem ||
      json?.error ||
      texto
    );
  } catch {
    return texto;
  }
}

// ================================================================
// FUNÇÃO BASE PARA REQUEST JSON
//
// IMPORTANTE:
// credentials: 'include'
//
// Isso é essencial para trabalhar com a sessão criada pelo
// Spring Security.
// ================================================================

async function request<T>(
  rota: string,
  options: RequestInit = {}
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  let resposta: Response;

  try {
    resposta = await fetch(
      `${API_URL}${rota}`,
      {
        credentials: 'include',

        ...options,

        signal:
          controller.signal,

        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/json',

          ...options.headers,
        },
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        'AbortError'
    ) {
      throw new Error(
        'Tempo esgotado ao conectar com o backend.'
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeoutId
    );
  }

  if (!resposta.ok) {
    const mensagem =
      await extrairMensagemResposta(
        resposta
      );

    throw new Error(
      mensagem ||
        'Erro na comunicação com o backend.'
    );
  }

  const texto =
    await resposta.text();

  return texto
    ? (JSON.parse(texto) as T)
    : (undefined as T);
}

// ================================================================
// FORMATA O NOME DO USUÁRIO
// ================================================================

export function formatarNomeUsuario(
  usuario: Usuario | null
) {
  const primeiroNome = (
    usuario?.nome ||
    usuario?.username ||
    'Usuário'
  )
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();

  return (
    primeiroNome
      .charAt(0)
      .toUpperCase() +
    primeiroNome.slice(1)
  );
}

// ================================================================
// CEP
// ================================================================

export function limparCep(
  cep: string
) {
  return String(
    cep || ''
  )
    .replace(/\D/g, '')
    .slice(0, 8);
}

export function formatarCep(
  cep?: string
) {
  const numeros =
    limparCep(
      cep || ''
    );

  if (
    numeros.length <= 5
  ) {
    return numeros;
  }

  return numeros.replace(
    /^(\d{5})(\d{1,3})$/,
    '$1-$2'
  );
}

// ================================================================
// VIACEP
// ================================================================

export async function buscarEnderecoPorCep(
  cep: string
): Promise<EnderecoViaCep> {
  const cepLimpo =
    limparCep(cep);

  if (
    cepLimpo.length !== 8
  ) {
    throw new Error(
      'O CEP precisa ter 8 números.'
    );
  }

  const resposta =
    await fetch(
      `https://viacep.com.br/ws/${cepLimpo}/json/`
    );

  if (!resposta.ok) {
    throw new Error(
      'Não foi possível buscar o CEP no ViaCEP.'
    );
  }

  const dados =
    await resposta.json();

  if (dados.erro) {
    throw new Error(
      'CEP inválido ou não encontrado.'
    );
  }

  return {
    cep:
      formatarCep(
        dados.cep ||
          cepLimpo
      ),

    endereco:
      dados.logradouro ||
      '',

    bairro:
      dados.bairro ||
      '',

    cidade:
      dados.localidade ||
      '',

    estado:
      dados.uf ||
      '',
  };
}

// ================================================================
// FOTO DO USUÁRIO
// ================================================================

export function getFotoUsuarioUrl(
  usuarioId?:
    | string
    | number
) {
  if (!usuarioId) {
    return null;
  }

  return `${API_URL}/usuarios/${usuarioId}/foto`;
}

// ================================================================
// NORMALIZA CATEGORIAS ANTIGAS
// ================================================================

export function normalizarCategorias(
  categorias?: string
) {
  return String(
    categorias || ''
  )
    .split(',')
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}

// ================================================================
// NORMALIZA FACILIDADES ANTIGAS
// ================================================================

export function normalizarFacilidades(
  facilidades?: string
) {
  return String(
    facilidades || ''
  )
    .split(',')
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}

// ================================================================
// AUTENTICAÇÃO
// ================================================================

// ================================================================
// 1. VERIFICA O STATUS DA CONTA
//
// Mesmo fluxo usado pelo Web.
//
// GET
// /usuarios/verificar-status-login?username=email
// ================================================================

export async function verificarStatusLogin(
  username: string
) {
  const usernameNormalizado =
    username
      .trim()
      .toLowerCase();

  return request<StatusLogin>(
    `/usuarios/verificar-status-login?username=${encodeURIComponent(
      usernameNormalizado
    )}`
  );
}

// ================================================================
// 2. LOGIN REAL DO SPRING SECURITY
//
// Mesmo endpoint e mesmo Content-Type usados pelo Web.
//
// POST /login
//
// Body:
// username=email
// password=senha
//
// Content-Type:
// application/x-www-form-urlencoded
// ================================================================

export async function login(
  username: string,
  password: string
) {
  const usernameNormalizado =
    username
      .trim()
      .toLowerCase();

  const body =
    new URLSearchParams();

  body.append(
    'username',
    usernameNormalizado
  );

  body.append(
    'password',
    password
  );

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const resposta =
      await fetch(
        `${API_URL}/login`,
        {
          method:
            'POST',

          credentials:
            'include',

          headers: {
            Accept:
              'application/json',

            'Content-Type':
              'application/x-www-form-urlencoded',
          },

          body:
            body.toString(),

          signal:
            controller.signal,
        }
      );

    if (!resposta.ok) {
      const mensagem =
        await extrairMensagemResposta(
          resposta
        );

      throw new Error(
        mensagem ||
          'E-mail ou senha inválidos.'
      );
    }

    // Não precisamos usar o objeto retornado pelo /login.
    //
    // A identidade real do usuário será obtida imediatamente
    // pela rota /usuarios/me.
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        'AbortError'
    ) {
      throw new Error(
        'Tempo esgotado ao conectar com o backend.'
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

// ================================================================
// 3. USUÁRIO AUTENTICADO
//
// Depois do POST /login, chamamos:
//
// GET /usuarios/me
//
// Se essa rota funcionar, significa que a sessão criada pelo
// Spring Security está válida.
//
// Isso elimina a necessidade de criar usuário falso/local.
// ================================================================

export async function buscarUsuarioAutenticado() {
  return request<Usuario>(
    '/usuarios/me'
  );
}

// ================================================================
// LOGOUT
//
// O backend atual possui:
//
// POST /logout
// ================================================================

export async function logout() {
  return request<void>(
    '/logout',
    {
      method: 'POST',
    }
  );
}

// ================================================================
// USUÁRIO
// ================================================================

export async function buscarUsuarioPorId(
  id: string | number
) {
  return request<Usuario>(
    `/usuarios/${id}`
  );
}

// ================================================================
// ATUALIZA NOME E CEP
//
// Essa rota exige sessão autenticada no backend.
//
// PUT /usuarios/{id}
// Content-Type: application/json
// ================================================================

export async function atualizarNomeECepUsuario(
  id: string | number,
  nome: string,
  cep: string
) {
  return request<Usuario>(
    `/usuarios/${id}`,
    {
      method: 'PUT',

      body:
        JSON.stringify({
          nome:
            nome.trim(),

          cep:
            limparCep(cep),
        }),
    }
  );
}

// ================================================================
// FOTO DO PERFIL
//
// PUT /usuarios/{id}/foto
//
// Também exige usuário autenticado.
// ================================================================

export async function atualizarFotoPerfil(
  id: string | number,
  imageUri: string,
  mimeType =
    'image/jpeg'
) {
  const formData =
    new FormData();

  const extensao =
    mimeType.includes(
      'png'
    )
      ? 'png'
      : 'jpg';

  const nomeArquivo =
    `foto-perfil-${id}.${extensao}`;

  // ==============================================================
  // WEB
  // ==============================================================

  if (
    Platform.OS === 'web'
  ) {
    const imagemResposta =
      await fetch(
        imageUri
      );

    const imagemBlob =
      await imagemResposta.blob();

    formData.append(
      'file',
      imagemBlob,
      nomeArquivo
    );
  } else {
    // ============================================================
    // ANDROID / IOS
    // ============================================================

    formData.append(
      'file',
      {
        uri:
          imageUri,

        name:
          nomeArquivo,

        type:
          mimeType,
      } as any
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const resposta =
      await fetch(
        `${API_URL}/usuarios/${id}/foto`,
        {
          method:
            'PUT',

          body:
            formData,

          credentials:
            'include',

          signal:
            controller.signal,

          headers: {
            Accept:
              'application/json',

            // NÃO definir Content-Type.
            //
            // O fetch monta automaticamente:
            // multipart/form-data; boundary=...
          },
        }
      );

    if (!resposta.ok) {
      const mensagem =
        await extrairMensagemResposta(
          resposta
        );

      throw new Error(
        mensagem ||
          `Erro ao atualizar foto de perfil. Status: ${resposta.status}`
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name ===
        'AbortError'
    ) {
      throw new Error(
        'Tempo esgotado ao atualizar a foto.'
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

// ================================================================
// CATEGORIAS
// ================================================================

export async function buscarCategoriasAtivas() {
  return request<Categoria[]>(
    '/categorias/ativas'
  );
}

// ================================================================
// FACILIDADES
// ================================================================

export async function buscarFacilidadesAtivas() {
  return request<Facilidade[]>(
    '/facilidades/ativas'
  );
}

// ================================================================
// ACADEMIAS
// ================================================================

export async function buscarAcademias() {
  return request<Academia[]>(
    '/academias'
  );
}

// ================================================================
// ACADEMIAS PRÓXIMAS
// ================================================================

export async function buscarAcademiasProximasDoUsuario(
  usuarioId:
    | string
    | number
) {
  return request<Academia[]>(
    `/academias/proximas/usuario/${usuarioId}`
  );
}

// ================================================================
// ACADEMIA POR ID
// ================================================================

export async function buscarAcademiaPorId(
  id: string | number
) {
  return request<Academia>(
    `/academias/${id}`
  );
}

// ================================================================
// FOTOS DAS ACADEMIAS
// ================================================================

export async function buscarFotosAcademia(
  academiaId:
    | string
    | number
) {
  return request<
    FotoAcademia[]
  >(
    `/fotos-academia/academia/${academiaId}`
  );
}

export function getFotoAcademiaUrl(
  fotoId?:
    | string
    | number
) {
  if (!fotoId) {
    return null;
  }

  return `${API_URL}/fotos-academia/${fotoId}/imagem?v=${Date.now()}`;
}

// ================================================================
// PRIMEIRA FOTO DA ACADEMIA
//
// O backend atual já retorna as fotos disponíveis.
// ================================================================

export async function buscarPrimeiraFotoAcademia(
  academiaId:
    | string
    | number
) {
  const fotos =
    await buscarFotosAcademia(
      academiaId
    );

  if (
    !fotos ||
    fotos.length === 0
  ) {
    return null;
  }

  return fotos[0];
}

// ================================================================
// FAVORITOS
// ================================================================

export async function buscarFavoritosDoUsuario(
  usuarioId:
    | string
    | number
) {
  return request<
    Academia[]
  >(
    `/favoritos/usuario/${usuarioId}`
  );
}

export async function alternarFavoritoNoBanco(
  usuarioId:
    | string
    | number,

  academiaId:
    | string
    | number
) {
  return request<{
    favoritado: boolean;
  }>(
    `/favoritos/toggle?usuarioId=${usuarioId}&academiaId=${academiaId}`,
    {
      method:
        'POST',
    }
  );
}

export function extrairIdsAcademiasFavoritas(
  academiasFavoritas:
    Academia[]
) {
  return academiasFavoritas.map(
    (academia) =>
      String(
        academia.id
      )
  );
}

// ================================================================
// AVALIAÇÕES
// ================================================================

// ================================================================
// ITEM DE AVALIAÇÃO
//
// Representa cada critério cadastrado no backend.
//
// Exemplo:
//
// {
//   id: 1,
//   nome: "Atendimento",
//   descricao: "Qualidade do atendimento da academia"
// }
//
// O Mobile não terá os critérios escritos manualmente.
// Eles serão carregados dinamicamente pelo backend.
// ================================================================

export type ItemAvaliacao = {
  id: string | number;

  nome: string;

  descricao?: string;

  statusItemAvaliacao?: string;
};

// ================================================================
// NOTA DE UM ITEM
//
// Essa estrutura representa a nota dada para cada critério
// dentro de uma avaliação já salva.
//
// Exemplo:
//
// {
//   itemId: 1,
//   itemNome: "Atendimento",
//   nota: 5
// }
// ================================================================

export type ItemNotaAvaliacao = {
  itemId: string | number;

  itemNome?: string;

  itemDescricao?: string;

  nota: number;

  statusAvaliacao?: boolean;
};

// ================================================================
// AVALIAÇÃO
//
// O backend continua retornando uma nota geral.
//
// Essa nota geral é calculada automaticamente a partir das
// notas dos critérios.
//
// Além disso, a avaliação pode trazer as notas individuais
// dentro do campo:
//
// avaliacao.itens
// ================================================================

export type Avaliacao = {
  id: string | number;

  // ==============================================================
  // COMENTÁRIO
  //
  // Mantemos por compatibilidade caso alguma resposta antiga
  // do backend ainda possua comentário.
  // ==============================================================

  comentario?: string | null;

  // ==============================================================
  // NOTA GERAL
  //
  // Média calculada pelo backend.
  // ==============================================================

  nota: number;

  // ==============================================================
  // ACADEMIA
  // ==============================================================

  academiaId?: string | number;

  academiaNome?: string;

  nomeAcademia?: string;

  // ==============================================================
  // USUÁRIO
  // ==============================================================

  usuarioId?: string | number;

  usuarioNome?: string;

  nomeUsuario?: string;

  // ==============================================================
  // DATAS
  // ==============================================================

  dataCadastro?: string;

  dataAtualizacao?: string;

  // ==============================================================
  // STATUS
  //
  // Exemplos possíveis:
  //
  // ATIVO
  // INATIVO
  // SUSPENSO
  // ==============================================================

  statusAvaliacao?: string;

  // ==============================================================
  // NOVO SISTEMA DE AVALIAÇÃO POR CRITÉRIOS
  //
  // Exemplo:
  //
  // itens: [
  //   {
  //     itemId: 1,
  //     itemNome: "Atendimento",
  //     nota: 5
  //   },
  //   {
  //     itemId: 2,
  //     itemNome: "Limpeza",
  //     nota: 4
  //   }
  // ]
  // ==============================================================

  itens?: ItemNotaAvaliacao[];

  // ==============================================================
  // FALLBACK PARA RESPOSTAS ANTIGAS
  //
  // Mantemos esses objetos porque versões anteriores do Mobile
  // trabalhavam com usuario e academia completos.
  // ==============================================================

  usuario?: {
    id: string | number;

    nome?: string;

    username?: string;
  };

  academia?: {
    id: string | number;

    nome?: string;
  };
};

// ================================================================
// BUSCAR CRITÉRIOS DE AVALIAÇÃO
//
// Backend:
//
// GET /avaliacoes/itens
//
// Essa rota retorna os critérios cadastrados no backend.
//
// Dessa forma, se o ADMIN cadastrar um novo critério,
// o Mobile consegue carregá-lo automaticamente.
// ================================================================

export async function buscarItensAvaliacao() {
  return request<ItemAvaliacao[]>(
    '/avaliacoes/itens'
  );
}

// ================================================================
// BUSCAR AVALIAÇÕES DA ACADEMIA
//
// Backend:
//
// GET /avaliacoes/academia/{academiaId}
//
// Também podemos passar o usuário:
//
// GET /avaliacoes/academia/{academiaId}?usuarioId={usuarioId}
//
// O usuarioId é importante porque o backend pode precisar
// identificar a avaliação pertencente ao usuário logado.
// ================================================================

export async function buscarAvaliacoesDaAcademia(
  academiaId: string | number,
  _usuarioId?: string | number
) {
  // A listagem é pública. O backend identifica o usuário autenticado pela
  // própria sessão quando precisa incluir a avaliação suspensa dele.
  // Não enviamos mais um usuarioId salvo localmente, evitando conflito entre
  // estado local e sessão real.
  return request<Avaliacao[]>(
    `/avaliacoes/academia/${encodeURIComponent(
      String(academiaId)
    )}`
  );
}

// ================================================================
// CRIAR OU EDITAR AVALIAÇÃO
//
// O mesmo endpoint serve para criar e atualizar.
//
// Backend:
//
// POST /avaliacoes?usuarioId=...&academiaId=...
//
// NOVO FORMATO:
//
// {
//   itens: [
//     {
//       itemId: 1,
//       nota: 5
//     },
//     {
//       itemId: 2,
//       nota: 4
//     }
//   ]
// }
//
// O Mobile NÃO envia mais uma nota geral manualmente.
//
// A nota geral será calculada pelo próprio backend.
// ================================================================

export async function criarAvaliacao(
  usuarioId: string | number,
  academiaId: string | number,
  dados: {
    itens: Array<{
      itemId: string | number;
      nota: number;
    }>;
  }
) {
  // ==============================================================
  // NORMALIZA OS ITENS
  //
  // Garantimos que nota sempre seja Number.
  //
  // Quanto ao ID:
  // normalmente o backend usa número.
  // ==============================================================

  const itensNormalizados =
    dados.itens.map((item) => ({
      itemId: Number(item.itemId),

      nota: Number(item.nota),
    }));

  return request<Avaliacao>(
    `/avaliacoes?usuarioId=${encodeURIComponent(
      String(usuarioId)
    )}&academiaId=${encodeURIComponent(
      String(academiaId)
    )}`,
    {
      method: 'POST',

      body: JSON.stringify({
        itens: itensNormalizados,
      }),
    }
  );
}

// ================================================================
// INATIVAR AVALIAÇÃO
//
// Backend:
//
// PUT
// /avaliacoes/{avaliacaoId}/inativar?usuarioId={usuarioId}
//
// A avaliação NÃO é apagada fisicamente.
// Ela apenas passa para outro status.
//
// Isso mantém o histórico no banco.
// ================================================================

export async function inativarAvaliacao(
  avaliacaoId: string | number,
  usuarioId: string | number
) {
  return request<void>(
    `/avaliacoes/${encodeURIComponent(
      String(avaliacaoId)
    )}/inativar?usuarioId=${encodeURIComponent(
      String(usuarioId)
    )}`,
    {
      method: 'PUT',
    }
  );
}

// ================================================================
// NOME DO USUÁRIO DA AVALIAÇÃO
//
// Dependendo do DTO retornado pelo backend,
// o nome pode vir em campos diferentes.
//
// Por isso mantemos vários fallbacks.
// ================================================================

export function getNomeUsuarioAvaliacao(
  avaliacao: Avaliacao
) {
  return (
    avaliacao.nomeUsuario ||
    avaliacao.usuarioNome ||
    avaliacao.usuario?.nome ||
    avaliacao.usuario?.username ||
    'Usuário'
  );
}

// ================================================================
// VERIFICA SE A AVALIAÇÃO PERTENCE AO USUÁRIO LOGADO
//
// Isso será utilizado no detalhes.tsx para mostrar:
//
// - Editar
// - Remover
//
// somente na avaliação do próprio usuário.
// ================================================================

export function avaliacaoPertenceAoUsuario(
  avaliacao: Avaliacao,
  usuarioId?: string | number
) {
  if (
    usuarioId === undefined ||
    usuarioId === null
  ) {
    return false;
  }

  const idUsuarioAvaliacao =
    avaliacao.usuarioId ??
    avaliacao.usuario?.id;

  if (
    idUsuarioAvaliacao === undefined ||
    idUsuarioAvaliacao === null
  ) {
    return false;
  }

  return (
    String(idUsuarioAvaliacao) ===
    String(usuarioId)
  );
}

// ================================================================
// VERIFICA SE A AVALIAÇÃO ESTÁ SUSPENSA
//
// Vamos utilizar essa função no detalhes.tsx.
//
// Se estiver suspensa, podemos bloquear ações que não devem ser
// permitidas e mostrar uma mensagem apropriada para o usuário.
// ================================================================

export function avaliacaoEstaSuspensa(
  avaliacao?: Avaliacao | null
) {
  return (
    String(
      avaliacao?.statusAvaliacao || ''
    ).toUpperCase() === 'SUSPENSO' ||
    String(
      avaliacao?.statusAvaliacao || ''
    ).toUpperCase() === 'SUSPENSA'
  );
}

// ================================================================
// PEGA A NOTA DE UM CRITÉRIO
//
// Essa função será útil quando o usuário for EDITAR uma avaliação.
//
// Exemplo:
//
// const nota = getNotaItemAvaliacao(
//   minhaAvaliacao,
//   item.id
// );
//
// Ela procura dentro de:
//
// avaliacao.itens
// ================================================================

export function getNotaItemAvaliacao(
  avaliacao: Avaliacao | null | undefined,
  itemId: string | number
) {
  if (
    !avaliacao ||
    !Array.isArray(avaliacao.itens)
  ) {
    return 0;
  }

  const itemEncontrado =
    avaliacao.itens.find(
      (item) =>
        String(item.itemId) ===
        String(itemId)
    );

  return itemEncontrado
    ? Number(itemEncontrado.nota)
    : 0;
}

// ================================================================
// VERIFICA SE TODOS OS CRITÉRIOS FORAM AVALIADOS
//
// O detalhes.tsx poderá usar isso antes de enviar.
//
// Retorna true somente quando TODOS possuem nota entre 1 e 5.
// ================================================================

export function todosItensAvaliados(
  itens: ItemAvaliacao[],
  notas: Record<string, number>
) {
  if (
    !Array.isArray(itens) ||
    itens.length === 0
  ) {
    return false;
  }

  return itens.every((item) => {
    const nota =
      Number(
        notas[String(item.id)] || 0
      );

    return (
      nota >= 1 &&
      nota <= 5
    );
  });
}

// ================================================================
// CONVERTE AS NOTAS PARA O FORMATO DO BACKEND
//
// No detalhes.tsx teremos algo parecido com:
//
// {
//   "1": 5,
//   "2": 4,
//   "3": 5
// }
//
// Essa função transforma em:
//
// [
//   {
//     itemId: 1,
//     nota: 5
//   },
//   {
//     itemId: 2,
//     nota: 4
//   }
// ]
// ================================================================

export function montarItensAvaliacaoParaEnvio(
  itens: ItemAvaliacao[],
  notas: Record<string, number>
) {
  return itens.map((item) => ({
    itemId: item.id,

    nota: Number(
      notas[String(item.id)] || 0
    ),
  }));
}