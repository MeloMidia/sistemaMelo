// WA color index → hex
export const WA_COLORS: Record<number, string> = {
  0: '#e91e8c',
  1: '#ff6b00',
  2: '#f0b429',
  3: '#4cd964',
  4: '#5ac8fa',
  5: '#007aff',
  6: '#5856d6',
  7: '#ff2d55',
  8: '#8e8e93',
}

// CRM stage name → priority (higher wins when chat has multiple labels)
export const STAGE_PRIORITY: Record<string, number> = {
  'Novo Contato': 1,
  'Em Conversa': 2,
  'Qualificado': 3,
  'Perdido': 4,
  'Cliente': 5,
}

// WA label name → CRM stage name
export const LABEL_TO_STAGE: Record<string, string> = {
  'Lead novo': 'Novo Contato',
  'Não respondeu': 'Novo Contato',
  'No respondeu': 'Novo Contato',
  'No lidas': 'Novo Contato',
  'Frio': 'Novo Contato',
  'Grupos': 'Novo Contato',
  'Vermelho': 'Novo Contato',
  'Vaga SDR': 'Novo Contato',
  'Atendimento': 'Em Conversa',
  'Lead quente': 'Em Conversa',
  'Favoritos': 'Em Conversa',
  'Aula': 'Em Conversa',
  'Aulo': 'Em Conversa',
  'Curso': 'Em Conversa',
  'Amarelo': 'Em Conversa',
  'Amarelo ': 'Em Conversa',
  'Qualificação': 'Qualificado',
  'Qualificao': 'Qualificado',
  'Agendou': 'Qualificado',
  'Negociação': 'Qualificado',
  'Negociao': 'Qualificado',
  'Verde': 'Qualificado',
  'VENDA CONCLUÍDA': 'Cliente',
  'VENDA CONCLUDA': 'Cliente',
  'Faltou na reunião': 'Perdido',
  'Faltou na reunio': 'Perdido',
  'No realizadas': 'Perdido',
}

// WA label ID → CRM stage name (bypasses name encoding issues)
export const LABEL_ID_TO_STAGE: Record<string, string> = {
  '1': 'Novo Contato',   // Não respondeu
  '9': 'Novo Contato',   // Frio
  '15': 'Novo Contato',  // Lead novo
  '29': 'Novo Contato',  // Vaga SDR
  '33': 'Novo Contato',  // Vermelho
  '36': 'Novo Contato',  // Grupos
  '37': 'Novo Contato',  // No lidas
  '20': 'Em Conversa',   // Lead quente
  '24': 'Em Conversa',   // Aula
  '30': 'Em Conversa',   // Atendimento
  '32': 'Em Conversa',   // Amarelo
  '35': 'Em Conversa',   // Favoritos
  '38': 'Em Conversa',   // Curso
  '17': 'Qualificado',   // Qualificação
  '18': 'Qualificado',   // Agendou
  '21': 'Qualificado',   // Negociação
  '31': 'Qualificado',   // Verde
  '7': 'Cliente',        // VENDA CONCLUÍDA
  '3': 'Perdido',        // Faltou na reunião
  '34': 'Perdido',       // No realizadas
}

// WA label ID → canonical name (to fix garbled names stored in DB)
export const LABEL_ID_TO_NAME: Record<string, string> = {
  '1': 'Não respondeu',
  '3': 'Faltou na reunião',
  '7': 'VENDA CONCLUÍDA',
  '17': 'Qualificação',
  '21': 'Negociação',
  '24': 'Aula',
  '32': 'Amarelo',
}
