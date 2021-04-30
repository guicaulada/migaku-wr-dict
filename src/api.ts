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
  WordReferenceTranslationItem,
} from "./types";

export function zipMigakuDictionary(path: string, dict: MigakuDictionary) {
  const file = new AdmZip();
  const folderName = path.split("/").pop()?.split(".").shift();
  file.addFile(
    `${folderName}/dictionary.json`,
    Buffer.from(JSON.stringify(dict.dictionary), "utf-8"),
  );
  file.addFile(
    `frequency.json`,
    Buffer.from(JSON.stringify(dict.frequency), "utf-8"),
  );
  file.addFile(
    `conjugations.json`,
    Buffer.from(JSON.stringify(dict.conjugations), "utf-8"),
  );
  if (dict.header) {
    file.addFile(`header.csv`, Buffer.from(dict.header, "utf-8"));
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
) {
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
        conjs.push({ inflected, dict: [data.word] });
      }
    }
    return conjs;
  }, []);
  const dictionary = [] as MigakuDictionaryItem[];
  for (const data of wrdata) {
    if (data.translations) {
      data.translations.forEach((tables) => {
        tables.translations.forEach((tr) => {
          dictionary.push({
            term: tr.from,
            altterm: "",
            pronunciation: data.pronWR || "",
            definition: generateMigakuDefinition(tr.to, tr.example, exOnDef),
            pos: tr.fromType || "",
            examples: tr.example.from.concat(tr.example.to).join("\n"),
            audio: data.audio ? data.audio[0] : "",
          });
        });
      });
    }
  }
  return { header, frequency, conjugations, dictionary };
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
  const url = `https://www.wordreference.com/${from}${to}/${word.normalize(
    "NFKD",
  )}`;
  const response = await axios.get(encodeURI(url), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
    },
  });
  const result = processHtml(response.data);
  result.frequency = frequency;
  result.word = word;
  if (!result.translations || !result.translations.length) {
    const err = (response as unknown) as AxiosError;
    err.message = "Translation not found.";
    throw err;
  }
  return result;
}

function processHtml(html: string): WordReferenceResult {
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
    .map(function (i, el) {
      return $(el).text();
    })
    .get()
    .map((e) => String(e))
    .filter((v, i, arr) => i == arr.indexOf(v));
  const tables = $("table.WRD")
    .map(function (i, el) {
      return el;
    })
    .get();
  result.translations = tables.map(mapWordReferenceTables);
  return result;
}

function mapWordReferenceTables(html: Element): WordReferenceTranslation {
  const $ = cheerio.load(html);
  let result = {} as WordReferenceTranslation;
  result.title = "";
  result.translations = [];
  $("tr").map((i, el) => {
    const element = $(el);
    const html = element.html();
    if (html) {
      if (isHeaderItem(element)) {
        result.title = element.text();
      } else if (isTranslationItem(element)) {
        result.translations.push(createTranslationItem(el));
      } else if (isExampleItem(element)) {
        result = pushExample(result, el);
      }
    }
  });
  return result;
}

function createTranslationItem(html: Element): WordReferenceTranslationItem {
  const $ = cheerio.load(html);
  const from = $("strong").text();
  $(".ToWrd em span").remove();
  $(".FrWrd em span").remove();
  const fromType = $(".FrWrd em").text();
  const toType = $(".ToWrd em").text();
  $(".ToWrd em").remove();
  const to = $(".ToWrd").text();
  return {
    from,
    fromType,
    toType,
    to,
    example: {
      from: [],
      to: [],
    },
  };
}

function pushExample(
  obj: WordReferenceTranslation,
  html: Element,
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

function isHeaderItem(element: Cheerio): boolean {
  return element.attr("class") === "wrtopsection";
}

function isTranslationItem(element: Cheerio): boolean {
  const id = element.attr("id");
  const clss = element.attr("class");
  return id !== undefined && (clss === "even" || clss === "odd");
}

function isExampleItem(element: Cheerio): boolean {
  const id = element.attr("id");
  const clss = element.attr("class");
  return id === undefined && (clss === "even" || clss === "odd");
}
