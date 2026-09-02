import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import type { Usuario } from '@/lib/api';
import { ehAdministrativo } from '@/lib/permissoes';

// ================================================================
// ROTAS PRINCIPAIS
// ================================================================

type RotaPrincipal =
  | '/academias'
  | '/favoritos'
  | '/painel'
  | '/perfil';

type Aba = {
  nome: string;
  rota: RotaPrincipal;
  iconeAtivo: string;
  iconeInativo: string;
};

type BottomTabBarProps = {
  // O usuário recebido pelas telas já veio de GET /usuarios/me.
  // Assim o menu não depende de um AsyncStorage possivelmente antigo.
  usuario?: Usuario | null;
};

// ================================================================
// USER
// ================================================================

const abasUsuario: Aba[] = [
  {
    nome: 'Academias',
    rota: '/academias',
    iconeAtivo: 'barbell',
    iconeInativo: 'barbell-outline',
  },
  {
    nome: 'Favoritos',
    rota: '/favoritos',
    iconeAtivo: 'star',
    iconeInativo: 'star-outline',
  },
  {
    nome: 'Perfil',
    rota: '/perfil',
    iconeAtivo: 'person',
    iconeInativo: 'person-outline',
  },
];

// ================================================================
// MANAGER / ADMIN
//
// IMPORTANTE:
// O backend usa MANAGER para gerente. Não usamos somente "GERENTE",
// pois isso foi a causa de o gerente receber a aba Favoritos antes.
// ================================================================

const abasAdministrativas: Aba[] = [
  {
    nome: 'Academias',
    rota: '/academias',
    iconeAtivo: 'barbell',
    iconeInativo: 'barbell-outline',
  },
  {
    nome: 'Painel',
    rota: '/painel',
    iconeAtivo: 'grid',
    iconeInativo: 'grid-outline',
  },
  {
    nome: 'Perfil',
    rota: '/perfil',
    iconeAtivo: 'person',
    iconeInativo: 'person-outline',
  },
];

export default function BottomTabBar({ usuario }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Enquanto a tela ainda não confirmou /usuarios/me, não mostramos
  // uma aba central errada. Academias e Perfil continuam disponíveis.
  const abasSemNivel: Aba[] = [abasUsuario[0], abasUsuario[2]];

  const abas = usuario
    ? ehAdministrativo(usuario)
      ? abasAdministrativas
      : abasUsuario
    : abasSemNivel;

  function irParaAba(rota: RotaPrincipal) {
    if (pathname === rota) {
      return;
    }

    router.replace(rota);
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: '#222',
        paddingTop: 8,
        paddingBottom: 12,
        paddingHorizontal: 10,
        flexDirection: 'row',
        justifyContent: 'space-around',
        elevation: 18,
      }}
    >
      {abas.map((aba) => {
        const ativo = pathname === aba.rota;

        return (
          <TouchableOpacity
            key={aba.rota}
            onPress={() => irParaAba(aba.rota)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 6,
            }}
          >
            <Ionicons
              name={
                ativo
                  ? (aba.iconeAtivo as any)
                  : (aba.iconeInativo as any)
              }
              size={24}
              color={ativo ? '#f97316' : '#aaa'}
            />

            <Text
              style={{
                color: ativo ? '#f97316' : '#aaa',
                fontSize: 12,
                fontWeight: ativo ? 'bold' : '600',
                marginTop: 3,
              }}
            >
              {aba.nome}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
