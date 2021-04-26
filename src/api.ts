import axios from "axios";
import cheerio, { Cheerio } from "cheerio";
import { Element } from "domhandler";
import fs from "fs";
import {
  WordReferenceResult,
  WordReferenceTranslation,
  WordReferenceTranslationItem,
} from "./types";

export async function getFrequencyList(
  lang: string,
  freq?: string,
): Promise<string[]> {
  if (!freq) {
    freq = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${lang}/${lang}_full.txt`;
  }
  if (freq.slice(0, 4) == "http") {
    return axios
      .get(freq)
      .then((r) => r.data.split("\n").map((w: string) => w.split(" ").shift()));
  } else {
    const data = fs.readFileSync(freq, "utf-8");
    return data.split("\n").map((w: string) => w.split(" ").shift()!);
  }
}

export async function wr(
  word: string,
  from: string,
  to: string,
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
  return processHtml(response.data);
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
    .get();
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
