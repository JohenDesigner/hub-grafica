import { createClient } from "npm:@supabase/supabase-js@2";
import { gerarResposta, temPreco } from "./ia.ts";

// Sugere uma resposta para a conversa aberta no hub (não envia nada).
const DONO = "50410c1d-9121-4a7e-8daf-21ebc6d8157b";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const MENSAGEM: Record<string, string> = {
  sem_chave: "Falta cadastrar a chave da OpenAI no Supabase (OPENAI_API_KEY).",
  chave_invalida: "A chave da OpenAI não foi aceita. Confira se colou a chave certa.",
  sem_credito: "A conta da OpenAI está sem crédito. Coloque crédito em platform.openai.com.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "metodo" }, 405);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  // chamada interna do webhook (loja fechada) usa a chave de serviço; do hub, o login do dono
  const interno = jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!interno) {
    const { data: u } = await sb.auth.getUser(jwt);
    if (u?.user?.id !== DONO) return resp({ erro: "Sem permissao" }, 403);
  }

  let corpo: any;
  try { corpo = await req.json(); } catch { return resp({ erro: "Pedido invalido" }, 400); }
  const clienteId = String(corpo.cliente_id || "");
  const { data: cli } = await sb.from("clientes").select("id, nome").eq("id", clienteId).eq("user_id", DONO).maybeSingle();
  if (!cli) return resp({ erro: "Cliente nao encontrado" }, 404);
  const { data: msgs } = await sb.from("whatsapp_mensagens").select("direcao, tipo, texto").eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false }).limit(20);
  const historico = (msgs || []).reverse();
  if (!historico.length) return resp({ erro: "vazio", mensagem: "Ainda não há mensagens nesta conversa." }, 400);

  const r = await gerarResposta(historico, cli.nome || "", interno && corpo.modo === "auto" ? "auto" : "sugestao");
  if (!r.texto) return resp({ erro: r.erro, mensagem: MENSAGEM[r.erro || ""] || "A IA não conseguiu responder agora. Tente de novo." }, 502);
  if (temPreco(r.texto)) return resp({ erro: "preco", mensagem: "A IA tentou passar um valor e a resposta foi bloqueada. Escreva você mesmo esta resposta." }, 422);
  return resp({ ok: true, texto: r.texto });
});
