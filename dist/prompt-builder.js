// Built from sillytavern-utils-lib via scripts/build-prompt-builder.mjs - do not edit directly, run `npm run build` after changing the dependency version.

// node_modules/sillytavern-utils-lib/dist/config.js
import { renderStoryString as y } from "/scripts/power-user.js";
import { persona_description_positions as Dt } from "/scripts/power-user.js";
import { getMaxContextSize as S, parseMesExamples as v, baseChatReplace as C, chat_metadata as o, sendMessageAsUser as b, name1 as I, this_chid as A, name2 as w, updateMessageBlock as P } from "/script.js";
import { characters as Gt, depth_prompt_depth_default as Bt, depth_prompt_role_default as zt, extension_prompt_types as Kt, main_api as Lt, name1 as Ut, name2 as Yt, systemUserName as Ht, system_avatar as jt, this_chid as qt } from "/script.js";
import { createWorldInfoEntry as E, createNewWorldInfo as T } from "/scripts/world-info.js";
import { METADATA_KEY as Qt, selected_world_info as Xt, wi_anchor_position as Zt, world_info as $t, world_info_include_names as te, world_names as ee } from "/scripts/world-info.js";
import { sendMessageAs as R, sendNarratorMessage as W } from "/scripts/slash-commands.js";
import { user_avatar as F } from "/scripts/personas.js";
import { user_avatar as oe } from "/scripts/personas.js";
import { formatInstructModeExamples as N, formatInstructModeSystemPrompt as O } from "/scripts/instruct-mode.js";
import { appendFileContent as k, hideChatMessageRange as D } from "/scripts/chats.js";
import { getPromptRole as V, prepareOpenAIMessages as G, setOpenAIMessages as B, setOpenAIMessageExamples as z, formatWorldInfo as K, getPromptPosition as L } from "/scripts/openai.js";
import { metadata_keys as p } from "/scripts/authors-note.js";
import { getGroupDepthPrompts as U } from "/scripts/group-chats.js";
import { groups as ae, is_group_generating as se, selected_group as ie } from "/scripts/group-chats.js";
import { getRegexedString as Y, runRegexScript as H } from "/scripts/extensions/regex/engine.js";
import { regex_placement as me } from "/scripts/extensions/regex/engine.js";
import { getCharaFilename as j } from "/scripts/utils.js";
import { removeFromArray as ue, runAfterAnimation as ce } from "/scripts/utils.js";
import { commonEnumProviders as _e, enumIcons as de } from "/scripts/slash-commands/SlashCommandCommonEnumsProvider.js";
import { SlashCommandEnumValue as xe, enumTypes as he } from "/scripts/slash-commands/SlashCommandEnumValue.js";
import { Popup as ye, fixToastrForDialogs as Se } from "/scripts/popup.js";
import { default as Ce } from "/lib/dialog-polyfill.esm.js";
function pt(t2) {
  return S(t2);
}
function mt(t2, e2) {
  return v(t2, e2);
}
function lt(t2, e2, r3) {
  return C(t2, e2, r3);
}
function ut(t2, e2, r3) {
  return N(t2, e2, r3);
}
function ct(t2, e2) {
  return O(t2, e2);
}
function ft(t2, {
  customStoryString: e2,
  customInstructSettings: r3
} = {}) {
  return y(t2, { customStoryString: e2, customInstructSettings: r3 });
}
function _t(t2) {
  return V(t2);
}
function dt() {
  return {
    prompt: o[p.prompt],
    interval: o[p.interval],
    position: o[p.position],
    depth: o[p.depth],
    role: o[p.role]
  };
}
function gt(t2, e2) {
  return U(t2, e2);
}
function xt({
  name2: t2,
  charDescription: e2,
  charPersonality: r3,
  Scenario: a,
  worldInfoBefore: n,
  worldInfoAfter: s2,
  bias: i,
  type: m,
  quietPrompt: l,
  quietImage: u2,
  extensionPrompts: c,
  cyclePrompt: f,
  systemPromptOverride: _2,
  jailbreakPromptOverride: d,
  personaDescription: g,
  messages: x,
  messageExamples: h
}, M) {
  return G(
    {
      name2: t2,
      charDescription: e2,
      charPersonality: r3,
      Scenario: a,
      worldInfoBefore: n,
      worldInfoAfter: s2,
      bias: i,
      type: m,
      quietPrompt: l,
      quietImage: u2,
      cyclePrompt: f,
      systemPromptOverride: _2,
      jailbreakPromptOverride: d,
      personaDescription: g,
      extensionPrompts: c,
      messages: x,
      messageExamples: h
    },
    M
  );
}
function ht(t2) {
  return B(t2);
}
function Mt(t2) {
  return z(t2);
}
function yt(t2, e2, {
  characterOverride: r3,
  isMarkdown: a,
  isPrompt: n,
  isEdit: s2,
  depth: i
}) {
  return Y(t2, e2, { characterOverride: r3, isMarkdown: a, isPrompt: n, isEdit: s2, depth: i });
}
async function vt(t2, e2) {
  return await k(t2, e2);
}
function Ct(t2, {
  wiFormat: e2
} = {}) {
  return K(t2, { wiFormat: e2 });
}
function bt(t2) {
  return L(t2);
}

// node_modules/sillytavern-utils-lib/dist/tokenizer.js
var t = class {
  /**
   * Encodes a string into a sequence of tokens using a simple heuristic.
   * This is a placeholder for a real tokenizer.
   */
  encode(e2) {
    const n = Math.ceil(e2.length / 4);
    return new Array(n).fill(" ");
  }
  /**
   * Decodes a sequence of tokens back into a string.
   * This is a placeholder and doesn't actually decode.
   */
  decode(e2) {
    return e2.join("");
  }
};

// node_modules/sillytavern-utils-lib/dist/prompt-message-utils.js
function r(n) {
  return typeof n == "string" && n.trim().length > 0;
}
function s(n) {
  const t2 = n.content;
  return typeof t2 == "string" ? t2 : Array.isArray(t2) ? t2.map((e2) => e2.type === "text" ? e2.text : "").filter(r).join(`
`) : "";
}
function o2(n) {
  const t2 = n.content;
  if (typeof t2 == "string")
    return r(t2) ? n : null;
  if (Array.isArray(t2)) {
    const e2 = t2.filter((i) => i.type !== "text" || r(i.text));
    return e2.length > 0 ? { ...n, content: e2 } : null;
  }
  return null;
}
function u(n) {
  return n.map((t2) => o2(t2)).filter((t2) => t2 !== null);
}

// node_modules/sillytavern-utils-lib/dist/prompt-slice-utils.js
function r2(o3) {
  return {
    startIndex: (o3 == null ? void 0 : o3.start) ?? 0,
    endIndex: (o3 == null ? void 0 : o3.end) === void 0 ? void 0 : o3.end + 1
  };
}

// node_modules/sillytavern-utils-lib/dist/world-info-scan-data.js
function e(r3 = {}) {
  return {
    personaDescription: r3.personaDescription ?? "",
    characterDescription: r3.characterDescription ?? "",
    characterPersonality: r3.characterPersonality ?? "",
    characterDepthPrompt: r3.characterDepthPrompt ?? "",
    scenario: r3.scenario ?? "",
    creatorNotes: r3.creatorNotes ?? "",
    trigger: r3.trigger ?? "normal"
  };
}

// node_modules/sillytavern-utils-lib/dist/prompt-builder.js
import { regex_placement as ve } from "/scripts/extensions/regex/engine.js";
import { world_info_include_names as at, wi_anchor_position as pt2 } from "/scripts/world-info.js";
import { name1 as C2, name2 as _, this_chid as z2, extension_prompt_types as v2, depth_prompt_role_default as ct2, depth_prompt_depth_default as mt2 } from "/script.js";
import { persona_description_positions as Ee } from "/scripts/power-user.js";
import { selected_group as Se2 } from "/scripts/group-chats.js";
var qe = Object.defineProperty;
var Ge = (m, n, o3) => n in m ? qe(m, n, { enumerable: true, configurable: true, writable: true, value: o3 }) : m[n] = o3;
var N2 = (m, n, o3) => Ge(m, typeof n != "symbol" ? n + "" : n, o3);
var lt2 = class {
  constructor(n) {
    N2(this, "messages", []);
    N2(this, "tokenizer");
    N2(this, "maxContext");
    N2(this, "currentTokenCount", 0);
    this.tokenizer = new t(), this.maxContext = n;
  }
  getTokenCount(n) {
    var c, u2;
    const o3 = s(n);
    return o3 ? ((u2 = (c = n.source) == null ? void 0 : c.extra) == null ? void 0 : u2.token_count) ?? this.tokenizer.encode(o3).length : 0;
  }
  canFit(n) {
    return this.currentTokenCount + this.getTokenCount(n) <= this.maxContext;
  }
  add(n) {
    const o3 = o2(n);
    if (!o3) return true;
    n = o3;
    const c = this.getTokenCount(n);
    return this.currentTokenCount + c > this.maxContext ? false : (this.messages.push(n), this.currentTokenCount += c, true);
  }
  addFront(n) {
    const o3 = o2(n);
    if (!o3) return true;
    n = o3;
    const c = this.getTokenCount(n);
    return this.currentTokenCount + c > this.maxContext ? false : (this.messages.unshift(n), this.currentTokenCount += c, true);
  }
  addMany(n) {
    const o3 = u(n), c = o3.map((f) => this.getTokenCount(f)), u2 = c.reduce((f, P2) => f + P2, 0);
    if (this.currentTokenCount + u2 <= this.maxContext)
      return this.messages.push(...o3), this.currentTokenCount += u2, true;
    let S2 = 0;
    const l = [];
    for (let f = o3.length - 1; f >= 0; f--) {
      const P2 = o3[f], I2 = c[f];
      if (this.currentTokenCount + S2 + I2 <= this.maxContext)
        l.unshift(P2), S2 += I2;
      else
        break;
    }
    return l.length > 0 && (this.messages.push(...l), this.currentTokenCount += S2), l.length === o3.length;
  }
  insert(n, o3) {
    const c = o2(o3);
    if (!c) return true;
    o3 = c;
    const u2 = this.getTokenCount(o3);
    return this.currentTokenCount + u2 > this.maxContext ? false : (this.messages.splice(n, 0, o3), this.currentTokenCount += u2, true);
  }
  getMessages() {
    return this.messages;
  }
};
async function kt(m, {
  targetCharacterId: n,
  presetName: o3,
  instructName: c,
  contextName: u2,
  syspromptName: S2,
  maxContext: l,
  includeNames: f,
  ignoreCharacterFields: P2,
  ignoreAuthorNote: I2,
  ignoreWorldInfo: ee2,
  messageIndexesBetween: Ie
} = {}) {
  var ie2, ae2, pe, ce2, me2, le, ue2, fe, de2, ge, he2, _e2, Pe, xe2, ye2, Me, we, Te;
  if (!["textgenerationwebui", "openai"].includes(m))
    throw new Error("Unsupported API");
  const s2 = SillyTavern.getContext();
  let { description: F2, personality: $, persona: K2, scenario: j2, mesExamples: Oe, system: x, jailbreak: Ae } = P2 ? {
    description: "",
    personality: "",
    persona: "",
    scenario: "",
    mesExamples: "",
    system: "",
    jailbreak: ""
  } : s2.getCharacterCardFields({
    chid: n
  });
  const O2 = m === "textgenerationwebui" ? (ie2 = s2.getPresetManager("instruct")) == null ? void 0 : ie2.getCompletionPresetByName(c) : void 0, L2 = !!(O2 != null && O2.enabled);
  let y2 = mt(Oe, L2);
  function Re() {
    var t2, p2;
    if (typeof l == "number")
      return l;
    if (!l)
      return pt();
    if (l === "active" || !o3)
      return pt();
    if (typeof l == "number")
      return l;
    let e2;
    if (m === "textgenerationwebui") {
      const r3 = (t2 = s2.getPresetManager("textgenerationwebui")) == null ? void 0 : t2.getCompletionPresetByName(o3);
      e2 = r3 == null ? void 0 : r3.max_length;
    } else {
      const r3 = (p2 = s2.getPresetManager("openai")) == null ? void 0 : p2.getCompletionPresetByName(o3);
      e2 = r3 == null ? void 0 : r3.openai_max_context;
    }
    return typeof e2 == "number" ? e2 : pt();
  }
  let M = [];
  const V2 = Re();
  if (V2 <= 0)
    return { result: [], warnings: M };
  const a = new lt2(V2), Be = s2.ToolManager.isToolCallingSupported(), { startIndex: te2, endIndex: oe2 } = r2(Ie);
  let k2 = te2 === -1 && oe2 === 0 ? [] : s2.chat.slice(te2, oe2).filter((e2) => {
    var t2;
    return !e2.is_system || Be && Array.isArray((t2 = e2.extra) == null ? void 0 : t2.tool_invocations);
  });
  k2 = await Promise.all(
    k2.map(async (e2, t2) => {
      var q, G2;
      let p2 = e2.mes, r3 = e2.is_user ? ve.USER_INPUT : ve.AI_OUTPUT, i = { isPrompt: true, depth: k2.length - t2 - 1 }, d = yt(p2, r3, i);
      return d = await vt(e2, d), (q = e2 == null ? void 0 : e2.extra) != null && q.append_title && ((G2 = e2 == null ? void 0 : e2.extra) != null && G2.title) && (d = `${d}

${e2.extra.title}`), {
        ...e2,
        mes: d,
        index: t2
      };
    })
  );
  const Ne = k2.map((e2) => at ? `${e2.name}: ${e2.mes}` : e2.mes).reverse(), Ue = n ?? z2, E2 = (ae2 = s2.characters[Ue]) == null ? void 0 : ae2.data, De = lt((me2 = (ce2 = (pe = E2 == null ? void 0 : E2.extensions) == null ? void 0 : pe.depth_prompt) == null ? void 0 : ce2.prompt) == null ? void 0 : me2.trim(), C2, _) || "", ze = e({
    personaDescription: K2,
    characterDescription: F2,
    characterPersonality: $,
    characterDepthPrompt: De,
    scenario: j2,
    creatorNotes: (E2 == null ? void 0 : E2.creator_notes) ?? ""
  }), { worldInfoString: ut2, worldInfoBefore: H2, worldInfoAfter: W2, worldInfoExamples: Fe, worldInfoDepth: $e, anBefore: se2, anAfter: ne } = ee2 ? {
    worldInfoString: "",
    worldInfoBefore: "",
    worldInfoAfter: "",
    worldInfoExamples: [],
    worldInfoDepth: [],
    anBefore: [],
    anAfter: []
  } : await s2.getWorldInfoPrompt(Ne, V2, false, ze);
  for (const e2 of Fe) {
    const t2 = e2.content;
    if (t2.length === 0)
      continue;
    const p2 = lt(t2, C2, _), r3 = mt(p2, L2);
    e2.position === pt2.before ? y2.unshift(...r3) : y2.push(...r3);
  }
  function re() {
    const e2 = [];
    for (let t2 = k2.length - 1; t2 >= 0; t2--) {
      const p2 = k2[t2], r3 = p2.name === "System" && !p2.is_user ? "system" : p2.is_user ? "user" : "assistant";
      e2.unshift({
        role: r3,
        content: f && r3 != "system" ? `${p2.name}: ${p2.mes}` : p2.mes,
        source: p2
      });
    }
    a.addMany(e2);
  }
  if (m === "textgenerationwebui") {
    const e2 = [...y2];
    y2 && (y2 = ut(y2, C2, _));
    const t2 = (le = s2.getPresetManager("sysprompt")) == null ? void 0 : le.getCompletionPresetByName(S2);
    t2 && (x = s2.powerUserSettings.prefer_character_prompt && x ? x : lt(t2.content, C2, _), x = L2 ? ct(
      s2.substituteParams(x, C2, _, t2.content),
      O2
    ) : x);
    const p2 = {
      description: F2,
      personality: $,
      persona: s2.powerUserSettings.persona_description_position == Ee.IN_PROMPT ? K2 : "",
      scenario: j2,
      system: x,
      char: _,
      user: C2,
      wiBefore: H2,
      wiAfter: W2,
      loreBefore: H2,
      loreAfter: W2,
      mesExamples: y2.join(""),
      mesExamplesRaw: e2.join("")
    }, r3 = (ue2 = s2.getPresetManager("context")) == null ? void 0 : ue2.getCompletionPresetByName(u2);
    let i = ft(p2, {
      customInstructSettings: O2,
      customStoryString: r3 == null ? void 0 : r3.story_string
    });
    i && a.add({ role: "system", content: i, ignoreInstruct: true }), re();
  } else {
    let e2 = function(h) {
      const T2 = g.find((X) => X.identifier === h);
      if (T2)
        return T2;
      const Ce2 = i.prompts.find((X) => X.identifier === h);
      if (Ce2)
        return Ce2;
    }, t2 = ht(k2), p2 = Mt(y2);
    async function r3() {
      let [h, T2] = await xt(
        {
          name2: _,
          charDescription: F2,
          charPersonality: $,
          Scenario: j2,
          worldInfoBefore: H2,
          worldInfoAfter: W2,
          extensionPrompts: s2.extensionPrompts,
          bias: "",
          type: "normal",
          quietPrompt: void 0,
          quietImage: void 0,
          cyclePrompt: "",
          systemPromptOverride: x,
          jailbreakPromptOverride: Ae,
          personaDescription: K2,
          messages: t2,
          messageExamples: p2
        },
        false
      );
      a.addMany(h);
    }
    if (!o3)
      return M.push("No preset name provided. Using default preset."), await r3(), { result: a.getMessages(), warnings: M };
    const i = (fe = s2.getPresetManager("openai")) == null ? void 0 : fe.getCompletionPresetByName(o3);
    if (!i)
      return console.warn(`Preset not found: ${o3}. Using current preset.`), M.push(`Preset not found: ${o3}. Using current preset.`), r3(), { result: a.getMessages(), warnings: M };
    let d = (de2 = i.prompt_order) == null ? void 0 : de2.find((h) => h.character_id === z2);
    if (!d && i.prompt_order && i.prompt_order.length > 0 && (d = i.prompt_order[i.prompt_order.length - 1]), !d)
      return console.warn(`No prompt order found for preset: ${o3}. Using current preset.`), M.push(`No prompt order found for preset: ${o3}. Using current preset.`), r3(), { result: a.getMessages(), warnings: M };
    const q = j2 && i.scenario_format ? s2.substituteParams(i.scenario_format) : "", G2 = $ && i.personality_format ? s2.substituteParams(i.personality_format) : "", He = s2.substituteParams(i.group_nudge_prompt), We = i.impersonation_prompt ? s2.substituteParams(i.impersonation_prompt) : "", g = [];
    ee2 || g.push(
      {
        role: "system",
        content: Ct(H2, { wiFormat: i.wi_format }),
        identifier: "worldInfoBefore"
      },
      {
        role: "system",
        content: Ct(W2, { wiFormat: i.wi_format }),
        identifier: "worldInfoAfter"
      }
    ), P2 || g.push(
      { role: "system", content: F2, identifier: "charDescription" },
      { role: "system", content: G2, identifier: "charPersonality" },
      { role: "system", content: q, identifier: "scenario" }
    ), g.push(
      { role: "system", content: We, identifier: "impersonate" },
      { role: "system", content: He, identifier: "groupNudge" }
    );
    const A2 = s2.extensionPrompts["1_memory"];
    A2 && A2.value && g.push({
      role: _t(A2.role),
      content: A2.value,
      identifier: "summary",
      position: bt(A2.position)
    });
    const R2 = s2.extensionPrompts["2_floating_prompt"];
    !I2 && R2 && R2.value && g.push({
      role: _t(R2.role),
      content: R2.value,
      identifier: "authorsNote",
      position: bt(R2.position)
    });
    const Q = s2.extensionPrompts["3_vectors"];
    Q && Q.value && g.push({
      role: "system",
      content: Q.value,
      identifier: "vectorsMemory",
      position: bt(Q.position)
    });
    const B2 = s2.extensionPrompts["4_vectors_data_bank"];
    B2 && B2.value && g.push({
      role: _t(B2.role),
      content: B2.value,
      identifier: "vectorsDataBank",
      position: bt(B2.position)
    });
    const J = s2.extensionPrompts.chromadb;
    J && J.value && g.push({
      role: "system",
      content: J.value,
      identifier: "smartContext",
      position: bt(J.position)
    }), !P2 && s2.powerUserSettings.persona_description && s2.powerUserSettings.persona_description_position === Ee.IN_PROMPT && g.push({
      role: "system",
      content: s2.powerUserSettings.persona_description,
      identifier: "personaDescription"
    }), d.order.forEach((h) => {
      if (!h.enabled)
        return;
      const T2 = e2(h.identifier);
      if (T2 && T2.content) {
        a.add({
          role: T2.role ?? "system",
          content: s2.substituteParams(T2.content)
        });
        return;
      }
      h.identifier === "chatHistory" && re();
    });
  }
  const je = [
    "1_memory",
    "2_floating_prompt",
    "3_vectors",
    "4_vectors_data_bank",
    "chromadb",
    "PERSONA_DESCRIPTION",
    "QUIET_PROMPT",
    "DEPTH_PROMPT"
  ];
  for (const e2 in s2.extensionPrompts)
    if (Object.hasOwn(s2.extensionPrompts, e2)) {
      const t2 = s2.extensionPrompts[e2];
      if (je.includes(e2) || !s2.extensionPrompts[e2].value || ![v2.BEFORE_PROMPT, v2.IN_PROMPT].includes(t2.position) || typeof t2.filter == "function" && !await t2.filter()) continue;
      const r3 = {
        role: _t(t2.role) ?? "system",
        content: t2.value
      };
      if (t2.position === v2.BEFORE_PROMPT)
        a.insert(t2.depth, r3);
      else if (t2.position === v2.IN_PROMPT) {
        const i = a.getMessages();
        a.insert(i.length - t2.depth, r3);
      }
    }
  for (const e2 of $e) {
    const t2 = a.getMessages();
    a.insert(t2.length - e2.depth, {
      role: _t(e2.role),
      content: e2.entries.join(`
`)
    });
  }
  if (!P2) {
    const e2 = gt(Se2, Number(z2));
    if (Se2 && Array.isArray(e2) && e2.length > 0)
      e2.filter((t2) => t2.text).forEach((t2, p2) => {
        const r3 = a.getMessages();
        a.insert(r3.length - t2.depth, { role: t2.role, content: t2.text });
      });
    else {
      const t2 = lt(
        (xe2 = (Pe = (_e2 = (he2 = (ge = s2.characters[z2]) == null ? void 0 : ge.data) == null ? void 0 : he2.extensions) == null ? void 0 : _e2.depth_prompt) == null ? void 0 : Pe.prompt) == null ? void 0 : xe2.trim(),
        C2,
        _
      ) || "";
      if (t2) {
        const p2 = mt2, r3 = ((Te = (we = (Me = (ye2 = s2.characters[z2]) == null ? void 0 : ye2.data) == null ? void 0 : Me.extensions) == null ? void 0 : we.depth_prompt) == null ? void 0 : Te.role) ?? ct2, i = a.getMessages();
        a.insert(i.length - p2, {
          role: _t(r3),
          content: t2
        });
      }
    }
  }
  let w2 = -1;
  if (!I2) {
    const e2 = dt();
    if (e2.prompt) {
      e2.prompt = lt(e2.prompt, C2, _);
      const t2 = { role: _t(e2.role), content: e2.prompt };
      switch (e2.position) {
        case v2.IN_PROMPT:
          a.insert(1, t2), w2 = 1;
          break;
        case v2.IN_CHAT:
          w2 = a.getMessages().length - e2.depth, a.insert(w2, t2);
          break;
        case v2.BEFORE_PROMPT:
          a.addFront(t2), w2 = 0;
          break;
      }
    }
  }
  return w2 >= 0 && (se2.length > 0 && (a.insert(w2, { role: "system", content: se2.join(`
`) }), w2++), ne.length > 0 && a.insert(w2 + 1, { role: "system", content: ne.join(`
`) })), { result: a.getMessages(), warnings: M };
}
export {
  kt as buildPrompt
};
