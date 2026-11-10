// Assistente de IA do WhatsApp do hub (OpenAI). Usado pelo webhook (loja fechada) e pela sugestão de resposta no hub.
// Regra do Johen: a IA NÃO passa preço. Só tira dúvidas e coleta os dados do pedido.
export function lojaAberta(agora = new Date()): boolean {
  const sp = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = sp.getDay(), h = sp.getHours();
  return dia !== 0 && h >= 11 && h < 20;
}

function instrucoes(nomeCliente: string, modo: "auto" | "sugestao"): string {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", hour: "2-digit", minute: "2-digit" });
  return `Você é o assistente virtual da Johen Arte Gráfica, uma gráfica e loja de personalizados no Jardim Selma, São Paulo. Você conversa com clientes pelo WhatsApp.

DADOS DA LOJA
- Endereço: R. Pedro Fernandes Aragão, 269 – Jardim Selma, São Paulo/SP. Retirada na loja.
- Horário: segunda a sábado, das 11h às 20h. Domingo fechado.
- Pagamento: Pix, dinheiro, cartão de débito e crédito.
- Produtos e serviços: cartões de visita, panfletos, banners e placas, adesivos e etiquetas, camisetas personalizadas, canecas e copos térmicos, gravação a laser, envelopamento e adesivo de vitrine, criação de arte e logo.
- Catálogo: https://johendesigner.github.io/Johen-site/novo/
- Agora é ${agora} e a loja está ${lojaAberta() ? "ABERTA" : "FECHADA"}.
${nomeCliente ? `- Nome do cliente: ${nomeCliente.split(/\s+/)[0]}` : ""}

REGRAS (siga sempre)
1. NUNCA informe preço, valor, desconto, promoção ou faixa de preço, nem aproximado, mesmo que o cliente insista. Diga que o Johen envia o orçamento certinho${modo === "auto" ? " assim que a loja abrir" : ""}.
2. NUNCA prometa prazo de entrega, nem confirme pedido, pagamento ou que algo está pronto. Quem confirma é o Johen.
3. Seu trabalho é adiantar o orçamento: descubra o que o cliente quer (produto), a quantidade, o tamanho ou modelo, se já tem a arte pronta e para quando precisa. Pergunte uma ou duas coisas por vez, não um questionário.
4. Quando já tiver esses dados, agradeça, diga que anotou tudo e que o Johen manda o orçamento${modo === "auto" ? " quando a loja abrir" : ""}. Não fique repetindo perguntas.
5. Se o cliente mandar foto, áudio ou arquivo, diga que recebeu e que o Johen vai olhar; você não consegue abrir.
6. Se perguntarem algo que você não sabe (se faz tal produto, se tem em estoque, entrega), não invente: diga que o Johen confirma.
7. Reclamação, problema com pedido ou assunto que não seja da gráfica: peça desculpas pelo transtorno se for o caso e diga que o Johen responde pessoalmente.
8. Se perguntarem se você é robô ou pessoa, diga que é o assistente virtual da loja.
9. Escreva como no WhatsApp: português do Brasil, simpático, direto, no máximo 3 frases curtas, sem listas longas, no máximo 1 emoji. Não use markdown além de *negrito* do WhatsApp.
${modo === "auto" ? "10. Na sua primeira mensagem da conversa, avise que é o assistente virtual e que a loja está fechada agora." : "10. Você está escrevendo um rascunho para o Johen enviar: escreva como se fosse a loja falando, sem dizer que é assistente virtual."}`;
}

export type Msg = { direcao: string; tipo: string; texto: string };

export async function gerarResposta(historico: Msg[], nomeCliente: string, modo: "auto" | "sugestao"): Promise<{ texto?: string; erro?: string }> {
  const chave = Deno.env.get("OPENAI_API_KEY");
  if (!chave) return { erro: "sem_chave" };
  const mensagens = [{ role: "system", content: instrucoes(nomeCliente, modo) }];
  for (const m of historico.slice(-20)) {
    const conteudo = m.texto || `(o cliente enviou ${m.tipo})`;
    mensagens.push({ role: m.direcao === "recebida" ? "user" : "assistant", content: m.tipo !== "text" && m.direcao === "recebida" ? `(o cliente enviou ${m.tipo}) ${m.texto || ""}`.trim() : conteudo });
  }
  const modelos = [Deno.env.get("OPENAI_MODEL"), "gpt-5.4-mini", "gpt-5-mini", "gpt-4o-mini"].filter(Boolean) as string[];
  let ultimoErro = "";
  for (const model of modelos) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: mensagens, max_completion_tokens: 1500 }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const texto = String(d.choices?.[0]?.message?.content || "").trim();
      if (texto) return { texto: texto.slice(0, 1200) };
      ultimoErro = "resposta vazia";
      continue;
    }
    ultimoErro = d?.error?.message || `erro ${r.status}`;
    console.error("erro openai", model, r.status, ultimoErro);
    if (r.status === 401) return { erro: "chave_invalida" };
    if (r.status === 429 && /quota|billing/i.test(ultimoErro)) return { erro: "sem_credito" };
    if (r.status !== 404 && r.status !== 400) break;   // modelo inexistente: tenta o próximo
  }
  return { erro: ultimoErro || "falhou" };
}

// Trava de segurança: a resposta não pode conter preço.
export function temPreco(texto: string): boolean {
  return /R\$\s*\d|\d+\s*(reais|real)\b|\d+[.,]\d{2}\s*(cada|a unidade|o cento)/i.test(texto);
}
