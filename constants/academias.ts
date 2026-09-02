// Dados locais antigos mantidos apenas como referência/fallback de desenvolvimento.
// O aplicativo atual busca as academias reais pelo backend em lib/api.ts.

export type AcademiaLocal = {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  cep: string;
  categorias: string[];
  avaliacao: number;
  descricao: string;
  infos: string[];
  imagemUrl?: string;
};

export const imagensAcademias: Record<string, any> = {
  '1': require('../assets/images/gym1.jpeg'),
  '2': require('../assets/images/gym2.webp'),
  '3': require('../assets/images/gym3.jpg'),
  '4': require('../assets/images/gym4.jpg'),
};

export const academiasLocais: AcademiaLocal[] = [
  {
    id: '1',
    nome: 'SMART FIT',
    endereco: 'Av. Vinte e Seis de Marco, 701 Centro',
    cidade: 'Barueri, SP',
    cep: '06401-050',
    categorias: ['Musculação'],
    avaliacao: 4.8,
    descricao: 'Academia de musculação com aparelhos modernos.',
    infos: [
      'Academia de musculação',
      'Aparelhos de alta qualidade',
      'Plano Black - direito de treinar em qualquer Smart Fit',
      'Banheiros com duchas',
    ],
  },
  {
    id: '2',
    nome: 'BLUE FIT',
    endereco: 'Av. Trindade, 344 Bethaville I',
    cidade: 'Barueri, SP',
    cep: '06404-326',
    categorias: ['Musculação', 'Ginástica'],
    avaliacao: 4.9,
    descricao: 'Academia com musculação e aulas coletivas.',
    infos: [
      'Academia de musculação',
      'Aparelhos de alta qualidade',
      'Plano Gold - treine em todas unidades',
    ],
  },
  {
    id: '3',
    nome: 'BIO RITMO',
    endereco: 'Av. Piracema, 669 - Tambore',
    cidade: 'Barueri, SP',
    cep: '06460-030',
    categorias: ['Musculação', 'Ginástica'],
    avaliacao: 4.7,
    descricao: 'Academia premium com equipamentos de alta qualidade.',
    infos: [
      'Academia de musculação, ginástica, burn e race',
      'Aparelhos de última geração',
      'Plano Platinum',
      'Acesso aos estúdios da unidade',
    ],
  },
  {
    id: '4',
    nome: 'GAVIOES',
    endereco: 'Av. Jurua, 253 - Alphaville',
    cidade: 'Barueri, SP',
    cep: '06455-020',
    categorias: ['Musculação', 'Lutas'],
    avaliacao: 4.6,
    descricao: 'Academia focada em musculação e lutas.',
    infos: [
      'Musculação e artes marciais',
      'Sala de bike e rooftop',
      'Pilates e aulas aeróbicas',
      'Planos mensal, trimestral e anual',
    ],
  },
];

export function getAcademiaImagem(academia: AcademiaLocal) {
  if (academia.imagemUrl) {
    return { uri: academia.imagemUrl };
  }

  return imagensAcademias[academia.id] || imagensAcademias['1'];
}
