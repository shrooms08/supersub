// Country flag emoji for a team name. Emoji flags: zero assets, zero
// licensing. Most are built from the ISO-3166 alpha-2 code as regional
// indicator symbols; the home nations use subdivision (tag) flags.
// A team with no mapping returns null, and the caller renders nothing
// rather than a wrong flag.

const ISO2: Record<string, string> = {
  Argentina: "AR",
  Egypt: "EG",
  Norway: "NO",
  Switzerland: "CH",
  Colombia: "CO",
  France: "FR",
  Morocco: "MA",
  Spain: "ES",
  Belgium: "BE",
  USA: "US",
  "United States": "US",
  Portugal: "PT",
  Mexico: "MX",
  Brazil: "BR",
  Paraguay: "PY",
  Canada: "CA",
  Ghana: "GH",
  "Cape Verde": "CV",
  Vietnam: "VN",
  Myanmar: "MM",
  Australia: "AU",
  Germany: "DE",
  Italy: "IT",
  Netherlands: "NL",
  Croatia: "HR",
  Japan: "JP",
  "South Korea": "KR",
  "Korea Republic": "KR",
  Senegal: "SN",
  Nigeria: "NG",
  Uruguay: "UY",
  Denmark: "DK",
  Poland: "PL",
  Serbia: "RS",
  Switzerland_: "CH",
  Ecuador: "EC",
  Ghana_: "GH",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Tunisia: "TN",
  Cameroon: "CM",
  Ivory: "CI",
  "Ivory Coast": "CI",
  "Cote d'Ivoire": "CI",
  Peru: "PE",
  Chile: "CL",
  Costa: "CR",
  "Costa Rica": "CR",
  Panama: "PA",
  Jamaica: "JM",
  Iran: "IR",
  Iraq: "IQ",
  Turkey: "TR",
  "Turkiye": "TR",
  Sweden: "SE",
  Austria: "AT",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  Ukraine: "UA",
  Greece: "GR",
  Romania: "RO",
  Hungary: "HU",
  Ireland: "IE",
  Algeria: "DZ",
  "South Africa": "ZA",
  "New Zealand": "NZ",
  "Republic of Ireland": "IE",
  Slovenia: "SI",
  Slovakia: "SK",
  Georgia: "GE",
  Albania: "AL",
  China: "CN",
  "China PR": "CN",
  Uzbekistan: "UZ",
  Jordan: "JO",
};

// Subdivision (tag) flag, e.g. England = base flag + tag("gbeng") + cancel.
function subdivisionFlag(code: string): string {
  const base = String.fromCodePoint(0x1f3f4);
  const tags = [...code].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("");
  return base + tags + String.fromCodePoint(0xe007f);
}

const SPECIAL: Record<string, string> = {
  England: subdivisionFlag("gbeng"),
  Scotland: subdivisionFlag("gbsct"),
  Wales: subdivisionFlag("gbwls"),
};

function iso2ToEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function flagFor(teamName: string | undefined | null): string | null {
  if (!teamName) return null;
  const name = teamName.trim();
  if (SPECIAL[name]) return SPECIAL[name];
  const iso2 = ISO2[name];
  return iso2 ? iso2ToEmoji(iso2) : null;
}
