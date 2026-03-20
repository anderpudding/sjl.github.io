export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/lol-summary") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const RIOT_API_KEY = env.RIOT_API_KEY;
      if (!RIOT_API_KEY) {
        return json({ error: "Missing RIOT_API_KEY secret" }, 500);
      }

      const PROFILE = {
        gameName: "Samira mira e e",
        tagLine: "SJL",
        region: "na1",
        routingRegion: "americas",
        queue: "Ranked Solo/Duo",
        rankHistory: [
          { season: "S21", tier: "Silver I", lp: 89 },
          { season: "S22", tier: "Silver II", lp: 25 },
          { season: "S23S1", tier: "Silver II", lp: 0 },
          { season: "S23S2", tier: "Platinum IV", lp: 1 },
          { season: "S24S1", tier: "Gold II", lp: 25 },
          { season: "S24S2", tier: "Gold IV", lp: 43 },
          { season: "S24S3", tier: "Gold IV", lp: 25 },
          { season: "S25", tier: "Gold III", lp: 93 },
          { season: "S26", tier: "Platinum II", lp: 47 }
        ]
      };

      const rankTierBase = {
        IRON: 4,
        BRONZE: 8,
        SILVER: 12,
        GOLD: 16,
        PLATINUM: 20,
        EMERALD: 24,
        DIAMOND: 28,
        MASTER: 32,
        GRANDMASTER: 33,
        CHALLENGER: 34
      };

      const divisionOffset = {
        IV: 0,
        III: 1,
        II: 2,
        I: 3
      };

      function safeDivide(a, b) {
        return b === 0 ? 0 : a / b;
      }

      function round(value, decimals = 1) {
        return Number(value.toFixed(decimals));
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function normalizeToTen(value, min, max) {
        if (max === min) return 0;
        const ratio = (value - min) / (max - min);
        return round(clamp(ratio * 10, 0, 10), 1);
      }

      function parseTierDivision(tierString) {
        const parts = tierString.trim().split(/\s+/);
        return {
          tier: (parts[0] || "").toUpperCase(),
          division: (parts[1] || "").toUpperCase()
        };
      }

      function rankToValue(tier, division, lp = 0) {
        const base = rankTierBase[tier] ?? 0;
        const offset = divisionOffset[division] ?? 0;
        return round(base + offset + clamp(lp, 0, 100) / 100, 2);
      }

      function formatRankHistory() {
        return PROFILE.rankHistory.map(item => {
          const parsed = parseTierDivision(item.tier);
          return {
            season: item.season,
            tier: item.tier,
            lp: item.lp,
            value: rankToValue(parsed.tier, parsed.division, item.lp),
            label: `${item.tier} ${item.lp}LP`
          };
        });
      }

      function computeOpScore(stats) {
        const kdaScore = clamp(stats.kda * 1.9, 0, 10);
        const winScore = clamp(stats.winRate / 10, 0, 10);
        const dmgScore = stats.dmg;
        const visionScore = stats.wards;
        const csScore = stats.cs;
        const goldScore = stats.gold;
        const laneScore = stats.laning;

        const weighted =
          kdaScore * 0.24 +
          winScore * 0.24 +
          dmgScore * 0.14 +
          visionScore * 0.10 +
          csScore * 0.10 +
          goldScore * 0.09 +
          laneScore * 0.09;

        return round(clamp(weighted, 0, 10), 1);
      }

      async function riotFetch(targetUrl) {
        const response = await fetch(targetUrl, {
          headers: { "X-Riot-Token": RIOT_API_KEY }
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Riot API ${response.status}: ${text}`);
        }

        return response.json();
      }

      async function getDdragonVersion() {
        const response = await fetch("https://ddragon.leagueoflegends.com/realms/na.json");
        const data = await response.json();
        return data?.n?.champion || "14.24.1";
      }

      function championIcon(version, championName) {
        return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
      }

      const ddragonVersion = await getDdragonVersion();

      const account = await riotFetch(
        `https://${PROFILE.routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(PROFILE.gameName)}/${encodeURIComponent(PROFILE.tagLine)}`
      );

      const summoner = await riotFetch(
        `https://${PROFILE.region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
      );

      const leagueEntries = await riotFetch(
        `https://${PROFILE.region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`
      );

      const soloQueue = leagueEntries.find(entry => entry.queueType === "RANKED_SOLO_5x5") || null;

      const matchIds = await riotFetch(
        `https://${PROFILE.routingRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=40`
      );

      const matches = await Promise.all(
        matchIds.map(matchId =>
          riotFetch(`https://${PROFILE.routingRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`)
        )
      );

      const championMap = new Map();
      let totalKills = 0;
      let totalDeaths = 0;
      let totalAssists = 0;
      let totalWins = 0;
      let rankedGames = 0;

      for (const match of matches) {
        if (!match?.info?.participants) continue;
        if (match.info.queueId !== 420) continue;

        const participant = match.info.participants.find(p => p.puuid === account.puuid);
        if (!participant) continue;

        rankedGames += 1;
        totalKills += participant.kills || 0;
        totalDeaths += participant.deaths || 0;
        totalAssists += participant.assists || 0;
        totalWins += participant.win ? 1 : 0;

        const gameMinutes = safeDivide(match.info.gameDuration || 0, 60);
        const championName = participant.championName;

        const current = championMap.get(championName) || {
          champion: championName,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          totalDamagePerMin: 0,
          totalVisionPerMin: 0,
          totalCsPerMin: 0,
          totalGoldPerMin: 0,
          totalGoldDiffAt15: 0
        };

        const csTotal =
          (participant.totalMinionsKilled || 0) +
          (participant.neutralMinionsKilled || 0);

        current.games += 1;
        current.wins += participant.win ? 1 : 0;
        current.kills += participant.kills || 0;
        current.deaths += participant.deaths || 0;
        current.assists += participant.assists || 0;
        current.totalDamagePerMin += safeDivide(participant.totalDamageDealtToChampions || 0, gameMinutes);
        current.totalVisionPerMin += safeDivide(participant.visionScore || 0, gameMinutes);
        current.totalCsPerMin += safeDivide(csTotal, gameMinutes);
        current.totalGoldPerMin += safeDivide(participant.goldEarned || 0, gameMinutes);
        current.totalGoldDiffAt15 += participant.challenges?.goldDiffAt15 || 0;

        championMap.set(championName, current);
      }

      const rawTop = [...championMap.values()]
        .sort((a, b) => b.games - a.games)
        .slice(0, 5)
        .map(champ => {
          const kda = safeDivide(champ.kills + champ.assists, Math.max(1, champ.deaths));
          const winRate = safeDivide(champ.wins, champ.games) * 100;
          return {
            champion: champ.champion,
            icon: championIcon(ddragonVersion, champ.champion),
            games: champ.games,
            winRate: round(winRate, 1),
            kda: round(kda, 2),
            dmgRaw: champ.totalDamagePerMin / champ.games,
            wardsRaw: champ.totalVisionPerMin / champ.games,
            csRaw: champ.totalCsPerMin / champ.games,
            goldRaw: champ.totalGoldPerMin / champ.games,
            laningRaw: champ.totalGoldDiffAt15 / champ.games
          };
        });

      const statRange = (arr, fallbackMin, fallbackMax) => ({
        min: Math.min(...arr, fallbackMin),
        max: Math.max(...arr, fallbackMax)
      });

      const dmgRange = statRange(rawTop.map(x => x.dmgRaw), 0, 1000);
      const wardRange = statRange(rawTop.map(x => x.wardsRaw), 0, 2);
      const csRange = statRange(rawTop.map(x => x.csRaw), 0, 10);
      const goldRange = statRange(rawTop.map(x => x.goldRaw), 0, 500);
      const laneRange = statRange(rawTop.map(x => x.laningRaw), -500, 500);

      const topChampions = rawTop.map(champ => {
        const result = {
          champion: champ.champion,
          icon: champ.icon,
          games: champ.games,
          winRate: champ.winRate,
          kda: champ.kda,
          laning: normalizeToTen(champ.laningRaw, laneRange.min, laneRange.max),
          dmg: normalizeToTen(champ.dmgRaw, dmgRange.min, dmgRange.max),
          wards: normalizeToTen(champ.wardsRaw, wardRange.min, wardRange.max),
          cs: normalizeToTen(champ.csRaw, csRange.min, csRange.max),
          gold: normalizeToTen(champ.goldRaw, goldRange.min, goldRange.max),
          details: {
            dmgPerMin: round(champ.dmgRaw, 1),
            wardsPerMin: round(champ.wardsRaw, 2),
            csPerMin: round(champ.csRaw, 2),
            goldPerMin: round(champ.goldRaw, 1),
            goldDiffAt15: round(champ.laningRaw, 1)
          }
        };

        result.opScore = computeOpScore(result);
        return result;
      });

      const currentRank = soloQueue
        ? `${soloQueue.tier} ${soloQueue.rank} ${soloQueue.leaguePoints}LP`
        : "Unranked";

      return json({
        profile: {
          riotId: `${PROFILE.gameName}#${PROFILE.tagLine}`,
          level: summoner.summonerLevel,
          server: PROFILE.region.toUpperCase(),
          queue: PROFILE.queue
        },
        overview: {
          currentRank,
          seasonWinRate: rankedGames ? `${round((totalWins / rankedGames) * 100, 1)}%` : "0.0%",
          recentGames: rankedGames,
          avgKDA: round(safeDivide(totalKills + totalAssists, Math.max(1, totalDeaths)), 2),
          wins: totalWins,
          losses: rankedGames - totalWins
        },
        topChampions,
        rankHistory: formatRankHistory()
      });
    } catch (error) {
      return json({ error: error.message || "Unknown error" }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}