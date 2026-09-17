/*
 * Ohrly v0.2.3 — nomes/notas locais para o seed de Precedents.
 *
 * Uso:
 *   1. Rode supabase/seed_precedent_test.sql.
 *   2. Abra o Ohrly já autenticado.
 *   3. DevTools > Console > cole TODO este arquivo e pressione Enter.
 *   4. A página recarrega no caso Acme.
 *
 * Nenhum desses textos vai para o Supabase.
 */
(() => {
  const scope = localStorage.getItem("ohrly:private:scope:v1");
  if (!scope || scope === "signed-out") {
    throw new Error("Entre no Ohrly antes de aplicar os dados privados do seed.");
  }

  const key = `ohrly:private:v1:${scope}`;
  const empty = {
    episodeAliases: {},
    episodeNotes: {},
    interventionObjectives: {},
    updateTexts: {},
    accountData: {},
  };

  let store = empty;
  try {
    const raw = localStorage.getItem(key);
    store = raw ? { ...empty, ...JSON.parse(raw) } : { ...empty };
  } catch {
    store = { ...empty };
  }

  const BETA_ACCOUNT = "be7a0000-0000-4000-8000-000000000001";
  const ACME_ACCOUNT = "ac1e0000-0000-4000-8000-000000000002";
  const GAMMA_ACCOUNT = "6a6d0000-0000-4000-8000-000000000003";
  const DELTA_ACCOUNT = "de170000-0000-4000-8000-000000000004";

  const BETA_EPISODE = "be7a1000-0000-4000-8000-000000000001";
  const ACME_EPISODE = "ac1e1000-0000-4000-8000-000000000002";
  const GAMMA_EPISODE = "6a6d1000-0000-4000-8000-000000000003";
  const DELTA_EPISODE = "de171000-0000-4000-8000-000000000004";

  store.accountData[BETA_ACCOUNT] = {
    externalId: "seed-beta",
    name: "Beta Restaurante",
    owner: "CSM Demo",
    source: "precedent-seed",
    importedAt: new Date().toISOString(),
    attributes: { segmento: "SMB", momento: "pós-migração" },
  };
  store.accountData[ACME_ACCOUNT] = {
    externalId: "seed-acme",
    name: "Acme Food",
    owner: "CSM Demo",
    source: "precedent-seed",
    importedAt: new Date().toISOString(),
    attributes: { segmento: "SMB", momento: "pós-migração" },
  };
  store.accountData[GAMMA_ACCOUNT] = {
    externalId: "seed-gamma",
    name: "Gamma Bistrô",
    owner: "CSM Demo",
    source: "precedent-seed",
    importedAt: new Date().toISOString(),
    attributes: { segmento: "SMB", momento: "rotina" },
  };
  store.accountData[DELTA_ACCOUNT] = {
    externalId: "seed-delta",
    name: "Delta Café",
    owner: "CSM Demo",
    source: "precedent-seed",
    importedAt: new Date().toISOString(),
    attributes: { segmento: "SMB", momento: "sinal inicial" },
  };

  // Os textos são propositalmente diferentes: o teste positivo deve nascer da trajetória,
  // não de copiar palavras entre os dois casos.
  store.episodeAliases[BETA_EPISODE] = "Resistência após virada de plataforma";
  store.episodeNotes[BETA_EPISODE] = "Após a virada de plataforma, o responsável mostrou resistência e reduziu participação nas conversas.";
  store.updateTexts["be7a4000-0000-4000-8000-000000000001"] = "Surgiu uma objeção nova durante o acompanhamento.";
  store.interventionObjectives["be7a2000-0000-4000-8000-000000000001"] = "Reforçar ganhos concretos da nova operação e recuperar confiança.";

  store.episodeAliases[ACME_EPISODE] = "Engajamento caiu nas primeiras semanas";
  store.episodeNotes[ACME_EPISODE] = "O contato central passou a responder menos depois das primeiras semanas de uso.";
  store.updateTexts["ac1e4000-0000-4000-8000-000000000002"] = "Apareceu um novo indício de afastamento do usuário-chave.";
  store.interventionObjectives["ac1e2000-0000-4000-8000-000000000002"] = "Entender barreiras atuais antes de decidir a próxima abordagem.";

  store.episodeAliases[GAMMA_EPISODE] = "Queda pontual depois de uma reunião";
  store.episodeNotes[GAMMA_EPISODE] = "A conta reduziu atividade, mas respondeu bem à revisão de rotina.";
  store.updateTexts["6a6d4000-0000-4000-8000-000000000003"] = "Reunião realizada com boa participação.";
  store.interventionObjectives["6a6d2000-0000-4000-8000-000000000003"] = "Alinhar próximos passos na reunião periódica.";

  store.episodeAliases[DELTA_EPISODE] = "Sinal recente ainda pouco específico";
  store.episodeNotes[DELTA_EPISODE] = "Existe uma queda recente, mas ainda há pouca evidência sobre a trajetória.";
  store.updateTexts["de174000-0000-4000-8000-000000000004"] = "Primeiro indício adicional registrado.";

  localStorage.setItem(key, JSON.stringify(store));
  console.info("Ohrly precedent seed: dados privados aplicados. Abrindo o caso Acme…");
  window.location.href = "/episodes/ac1e1000-0000-4000-8000-000000000002";
})();
