// Busca os dados de uma empresa pelo CNPJ em APIs públicas e gratuitas (dados da Receita Federal).
// Tenta a BrasilAPI primeiro; se ela falhar, tenta a publica.cnpj.ws.
import { soDigitos } from './formato.js';

export function cnpjValido(texto) {
  const d = soDigitos(texto);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => {
    let soma = 0, peso = n - 7;
    for (let i = 0; i < n; i++) { soma += Number(d[i]) * peso--; if (peso < 2) peso = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export function formatarCnpj(texto) {
  const d = soDigitos(texto);
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : texto;
}

// MEI vem como "65.480.613 JOSE DA SILVA": tira o número da frente.
const semCnpj = s => String(s || '').replace(/^\s*\d{2}\.?\d{3}\.?\d{3}\s+/, '');
const titulo = s => semCnpj(s).toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase()).replace(/\b(Ltda|Me|Epp|Eireli|S\/a|Sa)\b/g, m => m.toUpperCase());

function montarEndereco({ logradouro, numero, complemento, bairro, cidade, uf, cep }) {
  const rua = logradouro?.trim() ? `${titulo(logradouro)}, ${numero && numero !== 'S/N' ? numero : 's/n'}` : '';
  const c = soDigitos(cep);
  return [
    [rua, complemento && titulo(complemento)].filter(Boolean).join(' - '),
    titulo(bairro),
    [titulo(cidade), uf].filter(Boolean).join('/'),
    c.length === 8 ? `CEP ${c.slice(0, 5)}-${c.slice(5)}` : ''
  ].filter(Boolean).join(' - ');
}

const telefone = t => {
  const d = soDigitos(t);
  if (d.length < 10) return '';
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
};

// Transforma a resposta de cada API no mesmo formato.
export function deBrasilApi(j) {
  return {
    razao: titulo(j.razao_social), fantasia: titulo(j.nome_fantasia),
    situacao: titulo(j.descricao_situacao_cadastral),
    telefone: telefone(j.ddd_telefone_1) || telefone(j.ddd_telefone_2),
    email: String(j.email || '').toLowerCase(), cep: soDigitos(j.cep),
    endereco: montarEndereco({ logradouro: [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '), numero: j.numero,
      complemento: j.complemento, bairro: j.bairro, cidade: j.municipio, uf: j.uf, cep: j.cep })
  };
}

export function deCnpjWs(j) {
  const e = j.estabelecimento || {};
  return {
    razao: titulo(j.razao_social), fantasia: titulo(e.nome_fantasia),
    situacao: titulo(e.situacao_cadastral),
    telefone: telefone(`${e.ddd1 || ''}${e.telefone1 || ''}`) || telefone(`${e.ddd2 || ''}${e.telefone2 || ''}`),
    email: String(e.email || '').toLowerCase(), cep: soDigitos(e.cep),
    endereco: montarEndereco({ logradouro: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' '), numero: e.numero,
      complemento: e.complemento, bairro: e.bairro, cidade: e.cidade?.nome, uf: e.estado?.sigla, cep: e.cep })
  };
}

async function pegar(url, sinal) {
  const r = await fetch(url, { signal: sinal });
  if (r.status === 404) throw Object.assign(new Error('CNPJ não encontrado na Receita'), { naoAchou: true });
  if (!r.ok) throw new Error(`Erro ${r.status}`);
  return r.json();
}

export async function buscarCnpj(texto, sinal) {
  const d = soDigitos(texto);
  if (!cnpjValido(d)) throw new Error('CNPJ inválido');
  try {
    return deBrasilApi(await pegar(`https://brasilapi.com.br/api/cnpj/v1/${d}`, sinal));
  } catch (err) {
    if (err.name === 'AbortError' || err.naoAchou) throw err;
    return deCnpjWs(await pegar(`https://publica.cnpj.ws/cnpj/${d}`, sinal));
  }
}

// ----- CEP -----
// Linha de endereço a partir do CEP (o número pode ficar vazio enquanto você não digita).
export function linhaEndereco({ logradouro, numero, complemento, bairro, cidade, uf, cep }) {
  const c = soDigitos(cep);
  return [
    [logradouro && (numero ? `${logradouro}, ${numero}` : logradouro), complemento].filter(Boolean).join(' - '),
    bairro, [cidade, uf].filter(Boolean).join('/'),
    c.length === 8 ? `CEP ${c.slice(0, 5)}-${c.slice(5)}` : ''
  ].filter(Boolean).join(' - ');
}

// Tenta a BrasilAPI; se falhar, o ViaCEP.
export async function buscarCep(texto, sinal) {
  const d = soDigitos(texto);
  if (d.length !== 8) throw new Error('CEP tem 8 números');
  try {
    const j = await pegar(`https://brasilapi.com.br/api/cep/v2/${d}`, sinal);
    return { logradouro: j.street || '', bairro: j.neighborhood || '', cidade: j.city || '', uf: j.state || '', cep: d };
  } catch (err) {
    if (err.name === 'AbortError' || err.naoAchou) throw err;
    const j = await pegar(`https://viacep.com.br/ws/${d}/json/`, sinal);
    if (j.erro) throw Object.assign(new Error('CEP não encontrado'), { naoAchou: true });
    return { logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '', cep: d };
  }
}
