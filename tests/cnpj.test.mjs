import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cnpjValido, formatarCnpj, deBrasilApi, deCnpjWs, linhaEndereco } from '../js/cnpj.js';

test('cnpjValido', () => {
  assert.ok(cnpjValido('65.480.613/0001-19'));
  assert.ok(cnpjValido('00000000000191'));          // Banco do Brasil
  assert.ok(!cnpjValido('65.480.613/0001-18'));
  assert.ok(!cnpjValido('11111111111111'));
  assert.ok(!cnpjValido('123'));
});
test('formatarCnpj', () => assert.equal(formatarCnpj('65480613000119'), '65.480.613/0001-19'));
test('deBrasilApi', () => {
  const e = deBrasilApi({ razao_social: 'GRAFICA EXEMPLO LTDA', nome_fantasia: 'GRAFICA DA ESQUINA', descricao_situacao_cadastral: 'ATIVA',
    ddd_telefone_1: '11982877142', email: 'CONTATO@EXEMPLO.COM', descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '120',
    complemento: 'SALA 2', bairro: 'CENTRO', municipio: 'SAO PAULO', uf: 'SP', cep: '01001000' });
  assert.equal(e.razao, 'Grafica Exemplo LTDA');
  assert.equal(e.fantasia, 'Grafica da Esquina');
  assert.equal(e.situacao, 'Ativa');
  assert.equal(e.telefone, '(11) 98287-7142');
  assert.equal(e.email, 'contato@exemplo.com');
  assert.equal(e.endereco, 'Rua das Flores, 120 - Sala 2 - Centro - Sao Paulo/SP - CEP 01001-000');
});
test('deCnpjWs', () => {
  const e = deCnpjWs({ razao_social: 'X COMERCIO ME', estabelecimento: { nome_fantasia: null, situacao_cadastral: 'Ativa', ddd1: '11', telefone1: '33334444',
    tipo_logradouro: 'AVENIDA', logradouro: 'PAULISTA', numero: '1000', bairro: 'BELA VISTA', cidade: { nome: 'São Paulo' }, estado: { sigla: 'SP' }, cep: '01310100' } });
  assert.equal(e.razao, 'X Comercio ME');
  assert.equal(e.fantasia, '');
  assert.equal(e.telefone, '(11) 3333-4444');
  assert.equal(e.endereco, 'Avenida Paulista, 1000 - Bela Vista - São Paulo/SP - CEP 01310-100');
});
test('MEI sem rua', () => {
  const e = deBrasilApi({ razao_social: '65.480.613 JOSE DA SILVA', nome_fantasia: '', logradouro: '', numero: '', bairro: 'JARDIM SELMA', municipio: 'SAO PAULO', uf: 'SP', cep: '04431160' });
  assert.equal(e.razao, 'Jose da Silva');
  assert.equal(e.endereco, 'Jardim Selma - Sao Paulo/SP - CEP 04431-160');
});
test('linhaEndereco', () => {
  const r = { logradouro: 'Rua Pedro Fernandes Aragão', bairro: 'Jardim Selma', cidade: 'São Paulo', uf: 'SP', cep: '04431160' };
  assert.equal(linhaEndereco(r), 'Rua Pedro Fernandes Aragão - Jardim Selma - São Paulo/SP - CEP 04431-160');
  assert.equal(linhaEndereco({ ...r, numero: '45' }), 'Rua Pedro Fernandes Aragão, 45 - Jardim Selma - São Paulo/SP - CEP 04431-160');
});
