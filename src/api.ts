import AdmZip from "adm-zip";
import axios from "axios";
import cheerio, { Cheerio } from "cheerio";
import { Element } from "domhandler";
import fs from "fs";
import {
  FrequencyItem,
  MigakuDictionary,
  MigakuDictionaryItem,
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
    `${folderName}/frequency.json`,
    Buffer.from(JSON.stringify(dict.frequency), "utf-8"),
  );
  file.addFile(`${folderName}/header.csv`, Buffer.from(dict.header, "utf-8"));
  if (path.slice(-4) != ".zip") {
    path = path + ".zip";
  }
  fs.writeFileSync(path, file.toBuffer());
}

export function generateMigakuDictionary(wrdata: WordReferenceResult[]) {
  const header = "term,altterm,pronunciation,definition,pos,examples,audio";
  const frequency = wrdata
    .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
    .map((data) => data.word);
  const dictionary = [] as MigakuDictionaryItem[];
  for (const data of wrdata) {
    if (data.translations) {
      data.translations.forEach((tables) => {
        tables.translations.forEach((tr) => {
          dictionary.push({
            term: tr.from,
            altterm: "",
            pronunciation: data.pronWR || "",
            definition: tr.to || "",
            pos: tr.fromType || "",
            examples: tr.example.from.concat(tr.example.to).join("\n"),
            audio: data.audio[0],
          });
        });
      });
    }
  }
  return { header, frequency, dictionary };
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
