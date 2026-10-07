# conty-integracao-rastreio

API para cadastrar um código de rastreio, consultar um agregador fictício e traduzir o dialeto da transportadora para um status estável. O prazo do conteúdo só importa depois que o pacote chega: a API avisa quando o tempo em trânsito passa de um limite, e não marca como atraso um pacote já entregue.

Status estáveis: `postado`, `em_transito`, `saiu_para_entrega`, `entregue`, `excecao`, `desconhecido`.

## Como rodar

Requer Node 20+.

```bash
npm install
npm test
```

Dois processos para experimentar localmente:

```bash
npm run aggregator
npm run dev
```

```bash
curl -s -X POST http://127.0.0.1:3000/rastreios \
  -H 'content-type: application/json' \
  -d '{"codigo":"BRATRASO000BR"}'

curl -s -X POST http://127.0.0.1:3000/rastreios \
  -H 'content-type: application/json' \
  -d '{"codigo":"BRENTREGUE00BR"}'
```

Códigos do agregador local:

| Código | O que acontece |
| --- | --- |
| `BRATRASO000BR` | Postado em janeiro e ainda em trânsito. `atrasado: true`. |
| `BRENTREGUE00BR` | Postado na mesma época e já entregue. `atrasado: false`. |
| `BRCAMINHO00BR` | Postado há cerca de 2 horas. Dentro do limite. |
| `BRDESCONHECIDO` | Último status bruto `BANANA_STATUS`. Vira `desconhecido`, nunca `entregue`. |

Variáveis:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API |
| `HOST` | `127.0.0.1` | Host da API |
| `AGGREGATOR_BASE_URL` | `http://127.0.0.1:4000` | Base do agregador |
| `DELAY_THRESHOLD_HOURS` | `72` | Limite de trânsito, em horas |
| `AGGREGATOR_PORT` | `4000` | Porta do agregador fictício de desenvolvimento |

`POST /rastreios` com `{ "codigo" }` cadastra e faz a primeira consulta. Repetir o POST atualiza sem criar outro cadastro. `GET /rastreios/:codigo` consulta de novo e devolve o histórico acumulado.

## Payload bruto e status normalizado

O agregador responde `GET /v1/track/{codigo}` neste formato. Ele só existe dentro de `src/providers/http-aggregator.ts`.

```json
{
  "tracking_code": "BR123456789BR",
  "carrier": "correios",
  "checkpoints": [
    {
      "timestamp": "2026-10-01T15:00:00.000Z",
      "status_code": "OBJ_POSTADO",
      "message": "Objeto postado",
      "city": "Curitiba"
    },
    {
      "timestamp": "2026-10-02T15:00:00.000Z",
      "status_code": "IN_TRANSIT",
      "message": "Em transferência",
      "city": "São Paulo"
    },
    {
      "timestamp": "2026-10-03T15:00:00.000Z",
      "status_code": "BANANA_STATUS",
      "message": "Código que a transportadora inventou",
      "city": "Guarulhos"
    }
  ]
}
```

Com o relógio em `2026-10-07T15:00:00.000Z` e limite de 72 horas, a API responde:

```json
{
  "codigo": "BR123456789BR",
  "status": "desconhecido",
  "atrasado": true,
  "motivo": "acima_do_limite",
  "limiteHoras": 72,
  "postadoEm": "2026-10-01T15:00:00.000Z",
  "horasDesdePostagem": 144,
  "historico": [
    {
      "ocorridoEm": "2026-10-01T15:00:00.000Z",
      "statusBruto": "OBJ_POSTADO",
      "status": "postado",
      "descricao": "Objeto postado"
    },
    {
      "ocorridoEm": "2026-10-02T15:00:00.000Z",
      "statusBruto": "IN_TRANSIT",
      "status": "em_transito",
      "descricao": "Em transferência"
    },
    {
      "ocorridoEm": "2026-10-03T15:00:00.000Z",
      "statusBruto": "BANANA_STATUS",
      "status": "desconhecido",
      "descricao": "Código que a transportadora inventou"
    }
  ]
}
```

`BANANA_STATUS` não está na tabela, então o mapeador devolve `desconhecido`. A busca é exata: `NOT_DELIVERED` e `ENTREGUE_AO_VIZINHO` também não viram `entregue`.

Se o último checkpoint fosse `DELIVERED`, o status seria `entregue`, `motivo` seria `entregue` e `atrasado` seria `false`, mesmo com 144 horas desde a postagem.

## Regra de atraso

O alerta é o campo `atrasado` da resposta. Não há e-mail nem webhook.

1. O status atual é o evento mais recente (`ocorridoEm`; empate desempata pelo status bruto).
2. Se esse status é `entregue`, não há atraso. A entrega encerra o alerta, tenha o trânsito durado o que durar.
3. Se não existe evento `postado`, não há atraso. A regra não inventa o início da contagem.
4. Caso contrário, conta as horas entre o `postado` mais antigo e o relógio atual. Passou do limite só quando as horas são **maiores** que `DELAY_THRESHOLD_HOURS`. No instante exato do limite, ainda não atrasou.
5. `em_transito`, `saiu_para_entrega`, `excecao` e `desconhecido` continuam elegíveis: o pacote ainda não chegou.

O relógio entra por injeção (`Clock`). Os testes fixam `now` em `2026-10-07T15:00:00.000Z` e não dependem do relógio da máquina. Consultar o mesmo código de novo não duplica o histórico: a chave é (código, timestamp em UTC, status bruto). Evento que desaparece numa resposta nova permanece guardado.

## Como trocar de agregador

1. Implemente `TrackingProvider` (`src/providers/tracking-provider.ts`).
2. Dentro dessa classe, leia o JSON do fornecedor novo e devolva `TrackingEvent[]`. Use `mapRawStatus` ou um mapeador próprio. O dialeto não sai dali.
3. Passe a instância para `buildApp({ provider })`.

`TrackingService`, o repositório e as rotas não importam `checkpoints`, `status_code` nem `tracking_code`. Um teste percorre esses arquivos para manter a fronteira, e outro registra um provider estático que não fala o HTTP do agregador fictício.

A persistência está atrás de `ShipmentRepository`. A implementação atual é memória de processo. Dá para substituir por SQLite sem mudar a regra de atraso nem o provider.

## O que ficou de fora

- Banco durável, autenticação e vários agregadores ao mesmo tempo.
- Aviso por e-mail, fila ou webhook. O aviso é o booleano `atrasado`.
- Cidade do checkpoint e o nome da transportadora.
- Retentativa com backoff. Falha do agregador responde 502 e preserva o histórico já salvo.
- Cadastro sem uma primeira consulta bem-sucedida.

## Por onde ler

1. `src/providers/tracking-provider.ts` — contrato.
2. `src/providers/http-aggregator.ts` — cliente e tradução do payload.
3. `src/domain/map-status.ts` — status bruto para status estável.
4. `src/domain/delay.ts` — atraso.
5. `tests/delay.test.ts`, `tests/map-status.test.ts` e `tests/api.test.ts`.

## Uso de IA

O código deste repositório foi gerado por um agente de IA (Cursor). O agente escreveu a API, o cliente HTTP, o mapeador, a regra de atraso, os testes e este README.

Revisado por Nicolas: [preencher]
