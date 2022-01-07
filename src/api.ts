import AdmZip from "adm-zip";
import axios, { AxiosError } from "axios";
import cheerio, { Cheerio } from "cheerio";
import { Element } from "domhandler";
import fs from "fs";
import {
  ConjugationItem,
  FrequencyItem,
  Language,
  MigakuDictionary,
  MigakuDictionaryItem,
  WordReferenceExample,
  WordReferenceResult,
  WordReferenceTranslation,
  WordReferenceTranslationItem
} from "./types";
import { expand, trimRegex } from "./utils";

export function getValidMonolingual(): string[] {
  return ["en", "es", "it"];
}

export function zipMigakuDictionary(
  path: string,
  dict: MigakuDictionary,
): void {
  const file = new AdmZip();
  const folderName = path.split("/").pop()?.split(".").shift();
  file.addFile(
    `${folderName}/dictionary.json`,
    Buffer.from(JSON.stringify(dict.dictionary), "utf-8"),
  );
  file.addFile(
    "frequency.json",
    Buffer.from(JSON.stringify(dict.frequency), "utf-8"),
  );
  file.addFile(
    "conjugations.json",
    Buffer.from(JSON.stringify(dict.conjugations), "utf-8"),
  );
  if (dict.header) {
    file.addFile("header.csv", Buffer.from(dict.header, "utf-8"));
  }
  if (path.slice(-4) != ".zip") {
    path = path + ".zip";
  }
  fs.writeFileSync(path, file.toBuffer());
}

export function generateMigakuDefinition(
  definition: string,
  examples: WordReferenceExample,
  exOnDef?: boolean,
): string {
  if (!definition) return "";
  if (!exOnDef || !examples) return definition;
  return `${definition}\n\n${examples.from.concat(examples.to).join("\n")}`;
}

export function generateMigakuDictionary(
  wrdata: WordReferenceResult[],
  header?: string,
  exOnDef?: boolean,
): MigakuDictionary {
  const frequency = wrdata
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
    .map((data) => data.word);
  const conjugations = wrdata.reduce((conjs: ConjugationItem[], data) => {
    if (data.inflections) {
      for (const inflected of data.inflections) {
        if (inflected != "") {
          conjs.push({ inflected, dict: [data.word] });
        }
      }
    }
    return conjs;
  }, []);
  const dictionary = [] as MigakuDictionaryItem[];
  for (const data of wrdata) {
    if (data.translations) {
      data.translations.forEach((tables) => {
        tables.translations.forEach((tr) => {
          const dictEl = {
            term: tr.from,
            altterm: "",
            pronunciation: data.pronWR || "",
            definition: generateMigakuDefinition(tr.to, tr.example, exOnDef),
            pos: tr.fromType || "",
            examples: tr.example.from.concat(tr.example.to).join("\n"),
            audio: data.audio ? data.audio[0] : "",
          };
          const existingEl = dictionary.find(
            (e) => e.definition == dictEl.definition && e.term == dictEl.term,
          );
          if (existingEl) {
            updateDictionaryDuplicate(existingEl, dictEl);
          } else {
            dictionary.push(dictEl);
          }
        });
      });
    }
  }
  return { header, frequency, conjugations, dictionary };
}

function updateDictionaryDuplicate(
  data: MigakuDictionaryItem,
  newData: MigakuDictionaryItem,
) {
  data.altterm = data.altterm || newData.altterm;
  data.pronunciation = data.pronunciation || newData.pronunciation;
  data.pos = data.pos || newData.pos;
  data.audio = data.audio || newData.audio;
}

function mapFrequencyList(data: string): FrequencyItem[] {
  return data.split("\n").map((w: string, i: number, arr: string[]) => {
    const word = w.split(" ").shift() || "";
    const frequency = Number(w.split(" ").pop()) || arr.length - i;
    return { word, frequency };
  });
}

export async function getFrequencyList(
  lang: string,
  freq?: string,
): Promise<FrequencyItem[]> {
  if (!freq) {
    freq = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_full.txt`;
  }
  if (freq.slice(0, 4) == "http") {
    return axios.get(freq).then((r) => mapFrequencyList(r.data));
  } else {
    const data = fs.readFileSync(freq, "utf-8");
    return mapFrequencyList(data);
  }
}

export async function getAvailableLanguages(): Promise<Language[]> {
  const url = "https://www.wordreference.com/";
  const response = await axios.get(encodeURI(url), {
    headers: {
      referer: "https://www.wordreference.com",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
    },
  });
  const $ = cheerio.load(response.data);
  const langNames = $(".links")
    .find("a")
    .map((i, el) => {
      return $(el).text();
    })
    .get()
    .map((e) => String(e));
  const langCodes = $(".links")
    .find("a")
    .map((i, el) => {
      return $(el).attr("hreflang");
    })
    .get()
    .map((e) => String(e));
  const langs = langCodes.reduce((langs: Language[], code, i) => {
    if (code === "el") {
      code = "gr";
    }
    langs.push({ code, name: langNames[i] });
    return langs;
  }, []);
  langs.push({ code: "en", name: "English" });
  return langs;
}

export async function wr(
  word: string,
  from: string,
  to: string,
  frequency?: number,
): Promise<WordReferenceResult> {
  const path = `/${from}${to}/${word.normalize("NFKD")}`;
  const url = `https://www.wordreference.com${path}`;
  const response = await axios.get<string>(encodeURI(url), {
    headers: {
      referer: "https://www.wordreference.com",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
    },
  });
  const result = processHtml(response.data, from == to);
  result.frequency = frequency;
  result.word = word;
  if (!result.translations || !result.translations.length) {
    if (response.data.includes("recaptcha")) {
      const err = (response as unknown) as AxiosError;
      err.message = "reCAPTCHA";
      throw err;
    }
  }
  return result;
}

function processHtml(html: string, monolingual?: boolean): WordReferenceResult {
  const $ = cheerio.load(html);
  const result = {} as WordReferenceResult;
  result.word = $("h3.headerWord").text();
  $("span.pronWR").find("span").not(".pronWR").remove();
  result.pronWR = $("span.pronWR").text().trim();
  result.audio = $("div#listen_widget audio source")
    .map((i, el) => {
      return $(el).attr("src");
    })
    .get()
    .map((e) => `https://www.wordreference.com${e}`);
  result.inflections = $(".inflectionsSection dt.ListInfl")
    .map((i, el) => {
      return $(el).text();
    })
    .get()
    .map((e) => String(e))
    .filter((v, i, arr) => i == arr.indexOf(v));
  if (!monolingual) {
    const tables = $("table.WRD").get();
    result.translations = tables.map(mapWordReferenceTables);
  } else {
    const lists = $("div.entryRH").get();
    result.translations = expand(lists.map(mapWorldReferenceListEntries));
  }
  return result;
}

function mapWorldReferenceListEntries(
  html: Element | string,
): WordReferenceTranslation[] {
  const $ = cheerio.load(html);
  const rh = $.html().split("rh_me");
  const div = "<div>";
  const prefix = '<span class="';
  const suffix = "</div>";
  return rh.slice(1).map((rest) => {
    let html = `${div}${prefix}rh_me${rest}`;
    if (html.endsWith(prefix)) {
      html = html.slice(0, -prefix.length);
    }
    if (!html.endsWith(suffix)) {
      html = html + suffix;
    }
    return mapWordReferenceLists(html);
  });
}

function mapWordReferenceLists(
  html: Element | string,
): WordReferenceTranslation {
  const $ = cheerio.load(html);
  const result = {} as WordReferenceTranslation;
  $(".rh_me sup").remove();
  result.title = $(".rh_me").text();
  result.translations = [];
  const pos = $(".rh_pos, .rh_empos")
    .map((i, el) => {
      return $(el).text();
    })
    .get()
    .map((e) => String(e));
  $("ol").map((i, el) => {
    const $ = cheerio.load(el);
    const list = $("ol > li, ol > span > li").get();
    result.translations.push(
      ...mapTranslationLists(result.title, pos[i], list),
    );
  });
  return result;
}

function mapTranslationLists(title: string, pos: string, li: Element[]) {
  return expand(
    li.map((el) => createListTranslationItem(title, pos, el)),
  ).filter((tr) => tr.to != "");
}

function createListTranslationItem(
  from: string,
  fromType: string,
  html: Element | string,
): WordReferenceTranslationItem[] {
  const $ = cheerio.load(html);
  $(".rh_def .rh_lab").remove();
  $(".rh_def .rh_cat").remove();
  $(".rh_def sup").remove();
  $(".rh_sdef .rh_lab").remove();
  $(".rh_sdef .rh_cat").remove();
  $(".rh_sdef sup").remove();
  const ex = $(".rh_def .rh_ex")
    .map((i, el) => {
      return $(el).text();
    })
    .get()
    .map((e) => String(e).trim());
  const sec_ex = $(".rh_sdef .rh_ex")
    .map((i, el) => {
      return $(el).text();
    })
    .get()
    .map((e) => String(e).trim());
  const sublists = $("li li").get();
  $(".rh_def > .rh_ex").remove();
  $(".rh_def > ul").remove();
  let def = $(".rh_def").text().trim().split(":").shift()!;
  const fromDef = $(".rh_def > b")
    .map((i, el) => {
      return $(el).text();
    })
    .get()
    .map((e) => String(e))
    .reduce(
      (t: string[], e) => (!t.join(" ").includes(e) ? t.concat([e.trim()]) : t),
      [],
    )
    .map((e) => trimRegex(/[.|,]/, e))
    .join(" or ");
  if (sublists && sublists.length) {
    def = trimRegex(/[.|,]/, def);
    return mapTranslationLists(def, fromType, sublists);
  } else if (!def) {
    $(".rh_sdef > .rh_ex").remove();
    def = $(".rh_sdef").text().trim().replace(/:/g, "");
  }
  if (fromDef) {
    from = fromDef;
    from.split(/\s+/g).forEach((w) => (def = def.replace(w, " ").trim()));
  }
  def = trimRegex(/[.|,]/, def).replace(/\s+/g, " ");
  return [
    mapTranslationItem(from, fromType, def, fromType, [], ex.concat(sec_ex)),
  ];
}

function mapWordReferenceTables(
  html: Element | string,
): WordReferenceTranslation {
  const $ = cheerio.load(html);
  let result = {} as WordReferenceTranslation;
  result.title = "";
  result.translations = [];
  $("tr").map((i, el) => {
    const element = $(el);
    const html = element.html();
    if (html) {
      if (isTableHeaderItem(element)) {
        result.title = element.text();
      } else if (isTableTranslationItem(element)) {
        result.translations.push(createTableTranslationItem(el));
      } else if (isTableExampleItem(element)) {
        result = pushTableExample(result, el);
      }
    }
  });
  return result;
}

function createTableTranslationItem(
  html: Element | string,
): WordReferenceTranslationItem {
  const $ = cheerio.load(html);
  const from = $("strong").text();
  $(".ToWrd em span").remove();
  $(".FrWrd em span").remove();
  const fromType = $(".FrWrd em").text();
  const toType = $(".ToWrd em").text();
  $(".ToWrd em").remove();
  const to = $(".ToWrd").text();
  return mapTranslationItem(from, fromType, to, toType);
}

function pushTableExample(
  obj: WordReferenceTranslation,
  html: Element | string,
): WordReferenceTranslation {
  const $ = cheerio.load(html);
  if ($(".FrEx").text() !== "") {
    $(".FrEx .tooltip").remove();
    obj.translations[obj.translations.length - 1].example.from.push(
      $(".FrEx").text().trim(),
    );
  } else if ($(".ToEx").text() !== "") {
    $(".ToEx .tooltip").remove();
    obj.translations[obj.translations.length - 1].example.to.push(
      $(".ToEx").text().trim(),
    );
  }
  return obj;
}

function isTableHeaderItem(element: Cheerio): boolean {
  return element.attr("class") === "wrtopsection";
}

function isTableTranslationItem(element: Cheerio): boolean {
  const id = element.attr("id");
  const clss = element.attr("class");
  return id !== undefined && (clss === "even" || clss === "odd");
}

function isTableExampleItem(element: Cheerio): boolean {
  const id = element.attr("id");
  const clss = element.attr("class");
  return id === undefined && (clss === "even" || clss === "odd");
}

function mapTranslationItem(
  from: string,
  fromType: string,
  to: string,
  toType: string,
  exampleFrom: string[] = [],
  exampleTo: string[] = [],
): WordReferenceTranslationItem {
  return {
    from,
    fromType,
    to,
    toType,
    example: {
      from: exampleFrom,
      to: exampleTo,
    },
  };
}
