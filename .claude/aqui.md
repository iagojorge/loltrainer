# Extração de Metadados do .ROFL + Runas + Stats + Assistir via LCU

## Visão Geral

Esta especificação cobre quatro adições ao sistema:

1. **Extrair patch e data** do arquivo `.rofl` e registrar no sistema e na tabela de histórico.
2. **Listar runas com seus dados de interação** (cura do Conquistador, recurso restaurado, dano bloqueado, etc.) — exatamente como o ReplayBook mostra.
3. **Aba de Stats** com status individual de cada jogador, gerando gráficos próprios (independentes do timeline).
4. **Assistir o replay no cliente** via LCU API (a técnica do `.bat` do replayit.gg).

Tudo isso é extraído direto do `.rofl`, **sem depender da API da Riot** e **sem depender da match history**.

---

## PARTE 1 — ESTRUTURA DO ARQUIVO .ROFL

### 1.1 Como o .rofl é organizado

O `.rofl` começa com a assinatura `RIOT`, seguida de um header binário com offsets, e contém um bloco de **metadados em JSON**. Dentro desse JSON estão:

- `gameLength` — duração da partida em milissegundos
- `gameVersion` — versão completa do jogo (ex: `14.12.598.1234`) → **daqui sai o patch**
- `statsJson` — uma **string** com JSON escapado, contendo um array com os 10 jogadores e todas as estatísticas individuais (incluindo runas)

> Observação importante: `statsJson` é uma string dentro do JSON. Precisa de **dois** `json.loads`: um para o metadado, outro para o conteúdo de `statsJson`.

### 1.2 Parser dos metadados (Python)

```python
import struct
import json
import os
from datetime import datetime

def parse_rofl_metadata(filepath):
    """
    Lê o header binário do .rofl e extrai o bloco de metadados JSON.
    Retorna metadados + lista de jogadores já desempacotada.
    """
    with open(filepath, "rb") as f:
        data = f.read()

    # Validar assinatura
    if data[:4] != b"RIOT":
        raise ValueError("Arquivo não é um .rofl válido")

    # Header: após a magic (6 bytes) + assinatura (256 bytes)
    # Layout (little-endian):
    #   headerLength   uint16
    #   fileLength     uint32
    #   metadataOffset uint32
    #   metadataLength uint32
    pos = 262
    header_length   = struct.unpack_from("<H", data, pos)[0]; pos += 2
    file_length     = struct.unpack_from("<I", data, pos)[0]; pos += 4
    metadata_offset = struct.unpack_from("<I", data, pos)[0]; pos += 4
    metadata_length = struct.unpack_from("<I", data, pos)[0]; pos += 4

    raw = data[metadata_offset : metadata_offset + metadata_length]
    metadata = json.loads(raw.decode("utf-8"))

    # statsJson é uma STRING com JSON escapado -> segundo parse
    metadata["players"] = json.loads(metadata.get("statsJson", "[]"))
    return metadata
```

> Se os offsets variarem entre versões e o parse falhar, use a biblioteca `roflparser` ou consulte a documentação do container ROFL do projeto **ReplayBook** (open source no GitHub) como referência do formato. Como fallback robusto, é possível localizar o início do JSON procurando pela sequência `{"gameLength"` nos bytes do arquivo.

### 1.3 Extrair patch e data

```python
def extract_patch(game_version):
    """
    gameVersion vem como '14.12.598.1234' -> patch '14.12'
    """
    if not game_version:
        return "Unknown"
    partes = game_version.split(".")
    return f"{partes[0]}.{partes[1]}" if len(partes) >= 2 else game_version


def extract_game_date(filepath, metadata):
    """
    A data nem sempre vem limpa nos metadados do .rofl.
    Estratégia em ordem de preferência:
      1. Campo de data nos metadados, se existir
      2. Data de modificação do arquivo (mtime) como fallback
    """
    # 1. Alguns .rofl trazem timestamp; tentar campos conhecidos
    for campo in ("gameCreation", "creationTime", "date"):
        if campo in metadata and metadata[campo]:
            try:
                # gameCreation costuma vir em ms epoch
                ts = int(metadata[campo])
                return datetime.fromtimestamp(ts / 1000).isoformat()
            except (ValueError, TypeError):
                pass

    # 2. Fallback: data de modificação do arquivo
    mtime = os.path.getmtime(filepath)
    return datetime.fromtimestamp(mtime).isoformat()
```

> O **patch** sai de forma confiável do `gameVersion`. A **data** é mais inconsistente entre versões do `.rofl`; por isso usamos o mtime do arquivo como rede de segurança, e deixamos o usuário ajustar manualmente no preview se necessário.

---

## PARTE 2 — RUNAS COM DADOS DE INTERAÇÃO

### 2.1 Onde estão as runas no statsJson

Cada jogador no `statsJson` tem os campos de runas:

| Campo | Significado |
|-------|-------------|
| `PERK0` a `PERK5` | IDs das 6 runas (keystone + 3 da árvore primária, 2 da secundária) |
| `PERK0_VAR1`, `PERK0_VAR2`, `PERK0_VAR3` | **Valores de interação** da runa 0 (e assim por diante até PERK5) |
| `PERK_PRIMARY_STYLE` | ID da árvore primária |
| `PERK_SUB_STYLE` | ID da árvore secundária |
| `STAT_PERK_0/1/2` | Shards (os 3 fragmentos de status) |

Os campos `PERK*_VAR*` são **exatamente** o que aparece no ReplayBook:
- Conquistador → `VAR` = Total de Cura (ex: 220)
- Presença de Espírito → `VAR` = Recurso restaurado (ex: 2300)
- Osso Revestido → `VAR` = Dano bloqueado (ex: 1128)
- Crescimento Excessivo → `VAR` = Vida máx. adicional (ex: 187)
- Até a Morte / Lenda → outros `VAR` correspondentes

### 2.2 Mapeamento de runa → label

O significado de cada `VAR1/VAR2/VAR3` **depende da runa**. Para exibir o rótulo correto ("Total de Cura", "Dano bloqueado"), use os dados de runas do **Data Dragon** ou **CommunityDragon** (`perks.json`), que mapeiam ID da runa → nome → descrição das variáveis.

```python
# Carregar uma vez na inicialização (Data Dragon / CommunityDragon)
import json

with open("perks.json", encoding="utf-8") as f:
    PERKS_DB = {p["id"]: p for p in json.load(f)}

def extract_runes(player):
    """
    Monta a lista de runas com IDs e valores de interação (VARs).
    """
    runes = []
    for i in range(6):
        perk_id = player.get(f"PERK{i}")
        if not perk_id:
            continue

        perk_info = PERKS_DB.get(int(perk_id), {})
        runes.append({
            "slot": i,
            "perk_id": int(perk_id),
            "name": perk_info.get("name", f"Perk {perk_id}"),
            "icon": perk_info.get("iconPath"),
            "vars": {
                "var1": player.get(f"PERK{i}_VAR1", 0),
                "var2": player.get(f"PERK{i}_VAR2", 0),
                "var3": player.get(f"PERK{i}_VAR3", 0),
            },
            # rótulos humanos vindos do perks.json, quando disponíveis
            "labels": perk_info.get("varLabels", ["Valor 1", "Valor 2", "Valor 3"]),
        })

    return {
        "primary_style": player.get("PERK_PRIMARY_STYLE"),
        "sub_style": player.get("PERK_SUB_STYLE"),
        "runes": runes,
        "shards": [
            player.get("STAT_PERK_0"),
            player.get("STAT_PERK_1"),
            player.get("STAT_PERK_2"),
        ],
    }
```

### 2.3 Exibição (igual ao ReplayBook)

```
┌──────────────────────────────────────────────┐
│  PatinhaDe Mamute#BR1 — Jayce                 │
├──────────────────────────────────────────────┤
│  🔴 Conquistador      Total de Cura: 220      │
│  🔵 Presença de Esp.  Recurso restaurado: 2300│
│  🟡 Lenda: Espont.    Tempo concluído: 16:50  │
│  🟠 Até a Morte       Dano adicional: 883     │
│  🟢 Osso Revestido    Dano bloqueado: 1128    │
│  🟢 Cresc. Excessivo  Vida máx. adic.: 187    │
│  [◆] [◆] [♥]  (shards)                        │
└──────────────────────────────────────────────┘
```

---

## PARTE 3 — STATS INDIVIDUAIS (PARA GRÁFICOS)

### 3.1 Campos úteis no statsJson

Cada jogador traz dezenas de campos. Os mais úteis para análise e gráficos:

| Campo no .rofl | Descrição |
|----------------|-----------|
| `NAME` | Nome do invocador |
| `SKIN` / `CHAMPION` | Campeão |
| `TEAM` | 100 (azul) ou 200 (vermelho) |
| `TEAM_POSITION` | TOP / JUNGLE / MIDDLE / BOTTOM / UTILITY |
| `WIN` | "Win" ou "Fail" |
| `CHAMPIONS_KILLED` | Kills |
| `NUM_DEATHS` | Deaths |
| `ASSISTS` | Assists |
| `MINIONS_KILLED` | CS de lane |
| `NEUTRAL_MINIONS_KILLED` | CS de jungle |
| `GOLD_EARNED` | Ouro total |
| `TOTAL_DAMAGE_DEALT_TO_CHAMPIONS` | Dano a campeões |
| `PHYSICAL_DAMAGE_DEALT_TO_CHAMPIONS` | Dano físico |
| `MAGIC_DAMAGE_DEALT_TO_CHAMPIONS` | Dano mágico |
| `TRUE_DAMAGE_DEALT_TO_CHAMPIONS` | Dano verdadeiro |
| `TOTAL_DAMAGE_TAKEN` | Dano recebido |
| `TOTAL_DAMAGE_SELF_MITIGATED` | Dano mitigado |
| `TOTAL_HEAL` | Cura total |
| `TIME_CCING_OTHERS` | Tempo de CC aplicado |
| `VISION_SCORE` | Vision score |
| `WARD_PLACED` | Wards colocados |
| `WARD_KILLED` | Wards destruídos |
| `LEVEL` | Nível final |
| `ITEM0` a `ITEM6` | Build final |

### 3.2 Extração das stats

```python
def extract_player_stats(player):
    """Normaliza os campos brutos do .rofl em um dicionário limpo"""
    def n(campo, default=0):
        try:
            return int(player.get(campo, default))
        except (ValueError, TypeError):
            return default

    cs = n("MINIONS_KILLED") + n("NEUTRAL_MINIONS_KILLED")

    return {
        "name": player.get("NAME"),
        "champion": player.get("SKIN"),
        "team": n("TEAM"),
        "position": player.get("TEAM_POSITION"),
        "win": player.get("WIN") == "Win",
        "level": n("LEVEL"),
        "kills": n("CHAMPIONS_KILLED"),
        "deaths": n("NUM_DEATHS"),
        "assists": n("ASSISTS"),
        "cs": cs,
        "gold": n("GOLD_EARNED"),
        "damage_champions": n("TOTAL_DAMAGE_DEALT_TO_CHAMPIONS"),
        "damage_physical": n("PHYSICAL_DAMAGE_DEALT_TO_CHAMPIONS"),
        "damage_magic": n("MAGIC_DAMAGE_DEALT_TO_CHAMPIONS"),
        "damage_true": n("TRUE_DAMAGE_DEALT_TO_CHAMPIONS"),
        "damage_taken": n("TOTAL_DAMAGE_TAKEN"),
        "damage_mitigated": n("TOTAL_DAMAGE_SELF_MITIGATED"),
        "heal": n("TOTAL_HEAL"),
        "cc_time": n("TIME_CCING_OTHERS"),
        "vision_score": n("VISION_SCORE"),
        "wards_placed": n("WARD_PLACED"),
        "wards_killed": n("WARD_KILLED"),
        "items": [n(f"ITEM{i}") for i in range(7)],
    }
```

### 3.3 Gráficos sugeridos (aba Stats)

Independentes do timeline. Cada um usa só os totais já extraídos:

1. **Dano a campeões por jogador** — bar chart comparando os 10 jogadores.
2. **Composição de dano** — stacked bar (físico / mágico / verdadeiro) por jogador.
3. **Ouro por jogador** — bar chart.
4. **Dano causado vs dano recebido** — scatter (eixo X = dano causado, Y = dano recebido) para identificar carregadores vs tanques.
5. **Eficiência de runa** — bar com os `VAR` agregados (ex: cura total do Conquistador no time).
6. **Vision score por jogador** — bar, separando supports.
7. **CС aplicado** — bar com `TIME_CCING_OTHERS`.
8. **CS por posição** — comparação de farm entre lanes.

---

## PARTE 4 — BANCO DE DADOS (SQLite)

### 4.1 Alterar tabela `matches`

```sql
ALTER TABLE matches ADD COLUMN patch TEXT;
ALTER TABLE matches ADD COLUMN game_version TEXT;
ALTER TABLE matches ADD COLUMN game_date TEXT;
```

### 4.2 Nova tabela de runas

```sql
CREATE TABLE IF NOT EXISTS player_runes (
    id TEXT PRIMARY KEY,
    match_id TEXT,
    summoner_name TEXT,
    slot INTEGER,            -- 0..5
    perk_id INTEGER,
    perk_name TEXT,
    var1 REAL,
    var2 REAL,
    var3 REAL,
    label TEXT,              -- "Total de Cura", etc.
    FOREIGN KEY (match_id) REFERENCES matches(id)
);
```

### 4.3 Stats já cabem em `player_stats`

Garanta que a tabela `player_stats` tenha colunas para os novos campos (`damage_physical`, `damage_magic`, `damage_true`, `damage_taken`, `damage_mitigated`, `heal`, `cc_time`). Adicione o que faltar com `ALTER TABLE`.

### 4.4 Salvar tudo no upload

```python
def save_full_match(match_id, filepath, metadata):
    patch = extract_patch(metadata.get("gameVersion"))
    game_date = extract_game_date(filepath, metadata)
    duration_ms = int(metadata.get("gameLength", 0))
    duration = f"{duration_ms//60000}:{(duration_ms//1000)%60:02d}"

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Determinar resultado pelo time 100 (azul) como referência
    players = metadata["players"]
    blue_win = any(p.get("TEAM") == "100" and p.get("WIN") == "Win" for p in players)

    cur.execute("""
        INSERT INTO matches (id, type, date, game_date, duration,
                             result, patch, game_version, replay_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        match_id, "scrim", datetime.now().isoformat(), game_date, duration,
        "win" if blue_win else "loss", patch, metadata.get("gameVersion"),
        filepath, datetime.now().isoformat()
    ))

    for p in players:
        stats = extract_player_stats(p)
        pid = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO player_stats (id, match_id, summoner_name, champion, role,
                level, kills, deaths, assists, cs, gold, damage,
                damage_taken, vision_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pid, match_id, stats["name"], stats["champion"], stats["position"],
            stats["level"], stats["kills"], stats["deaths"], stats["assists"],
            stats["cs"], stats["gold"], stats["damage_champions"],
            stats["damage_taken"], stats["vision_score"]
        ))

        # Runas com VARs
        rune_data = extract_runes(p)
        for r in rune_data["runes"]:
            cur.execute("""
                INSERT INTO player_runes (id, match_id, summoner_name, slot,
                    perk_id, perk_name, var1, var2, var3, label)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid.uuid4()), match_id, stats["name"], r["slot"],
                r["perk_id"], r["name"],
                r["vars"]["var1"], r["vars"]["var2"], r["vars"]["var3"],
                r["labels"][0] if r["labels"] else None
            ))

    conn.commit()
    conn.close()
    return {"patch": patch, "date": game_date, "duration": duration}
```

---

## PARTE 5 — TABELA DE HISTÓRICO COM PATCH E DATA

### 5.1 Nova coluna na tabela

```tsx
<table>
  <thead>
    <tr>
      <th>Data</th>
      <th>Patch</th>       {/* NOVO */}
      <th>Tipo</th>
      <th>Resultado</th>
      <th>Duração</th>
      <th>Ações</th>
    </tr>
  </thead>
  <tbody>
    {matches.map((m) => (
      <tr key={m.id}>
        <td>{new Date(m.game_date).toLocaleDateString()}</td>
        <td><span className="badge patch">{m.patch}</span></td>
        <td>{m.type === "scrim" ? "🎮 Scrim" : "⭐ Ranked"}</td>
        <td className={m.result}>{m.result === "win" ? "WIN" : "LOSS"}</td>
        <td>{m.duration}</td>
        <td>
          <button onClick={() => viewDetails(m.id)}>Detalhes</button>
          <button onClick={() => watchReplay(m.id)}>▶️ Assistir</button>
          <button onClick={() => downloadReplay(m.id)}>📥 Baixar</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### 5.2 Filtro por patch (já previsto no sistema)

O patch extraído agora alimenta o filtro de patch que já existe no dashboard. Scrims passam a ser filtráveis por versão igual às ranked.

---

## PARTE 6 — ASSISTIR REPLAY NO CLIENTE (LCU API)

> Baseado no `.bat` do replayit.gg. Roda o replay no **seu cliente**, inclusive arquivos que **não** são da sua match history. **Pré-requisito: o cliente do LoL precisa estar aberto.**

### 6.1 Endpoint Flask

```python
import shutil
import requests
import urllib3
urllib3.disable_warnings()  # a LCU usa certificado self-signed

def get_lcu_credentials(riot_base):
    """Lê o lockfile -> porta, senha, protocolo"""
    lockfile = os.path.join(riot_base, "League of Legends", "lockfile")
    if not os.path.exists(lockfile):
        raise FileNotFoundError("Lockfile não encontrado. O cliente está aberto?")
    with open(lockfile) as f:
        _name, _pid, port, password, protocol = f.read().split(":")
    return port, password, protocol


@app.route("/api/replays/<match_id>/watch", methods=["POST"])
def watch_replay(match_id):
    # Caminho do .rofl salvo
    conn = get_db()
    row = conn.execute("SELECT replay_path FROM matches WHERE id = ?",
                       (match_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Partida não encontrada"}), 404
    rofl_path = row["replay_path"]

    try:
        # Descobrir base da Riot (ajuste conforme instalação;
        # idealmente detectar pelo processo LeagueClientUx como no .bat)
        riot_base = RIOT_BASE_PATH
        port, password, protocol = get_lcu_credentials(riot_base)
        base_url = f"{protocol}://127.0.0.1:{port}"
        auth = ("riot", password)

        # 1. Pasta de replays via LCU
        replay_dir = requests.get(
            f"{base_url}/lol-replays/v1/rofls/path",
            auth=auth, verify=False, timeout=5
        ).json()

        # 2. Copiar o .rofl para a pasta de replays
        dest = os.path.join(replay_dir, "SISTEMA-1.rofl")
        shutil.copy(rofl_path, dest)

        # 3. Forçar scan (reconhece arquivo fora da match history)
        requests.post(f"{base_url}/lol-replays/v1/rofls/scan",
                      auth=auth, json={}, verify=False, timeout=5)

        # 4. Iniciar o replay
        requests.post(f"{base_url}/lol-replays/v1/rofls/1/watch",
                      auth=auth, json={}, verify=False, timeout=5)

        return jsonify({"status": "success",
                        "message": "Replay iniciado no cliente!"}), 200

    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 400
    except requests.exceptions.RequestException:
        return jsonify({"error": "Não foi possível falar com o cliente. "
                                 "Verifique se o LoL está aberto."}), 503
```

### 6.2 Detectar a base da Riot automaticamente (como no .bat)

```python
import subprocess

def detect_riot_base():
    """Acha o LeagueClientUx e deriva a pasta base da Riot."""
    try:
        out = subprocess.check_output([
            "powershell", "-NoProfile", "-Command",
            "Get-Process LeagueClientUx -ErrorAction SilentlyContinue | "
            "Select-Object -First 1 -ExpandProperty Path"
        ], text=True).strip()
        if out:
            # .../Riot Games/League of Legends/LeagueClientUx.exe
            lol_dir = os.path.dirname(out)
            return os.path.dirname(lol_dir)  # sobe para a base da Riot
    except subprocess.CalledProcessError:
        pass
    return None
```

### 6.3 Botão no frontend

```tsx
async function watchReplay(matchId) {
  try {
    const res = await fetch(`http://localhost:5000/api/replays/${matchId}/watch`, {
      method: "POST"
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Erro ao iniciar replay");
      return;
    }
    // Sucesso: o cliente abre o replay
  } catch (e) {
    alert("Abra o cliente do LoL antes de assistir.");
  }
}
```

---

## PARTE 7 — LIMITAÇÃO DE PATCH (HONESTO)

O método da LCU (Parte 6) roda no **seu cliente**, que está sempre no **patch atual**. Portanto:

- `.rofl` do **patch atual** → abre e roda normalmente.
- `.rofl` de **patch antigo** → não roda localmente (o motor do jogo não bate com a versão gravada).

O recurso de "assistir patch antigo dentro do site" que o replayit.gg oferece **não** é o cliente local — é renderização no servidor (máquinas com várias versões do jogo instaladas, que abrem o replay na versão correta e fazem streaming de vídeo). Isso é infraestrutura pesada e foge do escopo de um sistema local de time.

Recomendação: implemente Partes 1–6 (dados completos + assistir patch atual no cliente). Para patches antigos, registre os **dados** normalmente (que o parser extrai independente de patch) e, se precisar rever o vídeo de um patch velho, use o próprio replayit.gg pontualmente.

---

## RESUMO DO QUE FOI ADICIONADO

| Recurso | Fonte | Depende de patch? |
|---------|-------|-------------------|
| Patch + data no histórico | `.rofl` (gameVersion + mtime) | Não |
| Runas com dados de interação | `.rofl` (PERK*_VAR*) | Não |
| Stats individuais + gráficos | `.rofl` (statsJson) | Não |
| Assistir no cliente | LCU API (scan + watch) | **Sim** (só patch atual) |
| Assistir patch antigo no site | renderização server-side | Fora de escopo |
