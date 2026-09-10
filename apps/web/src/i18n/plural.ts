const pluralRules = new Intl.PluralRules("en");

export function formatPlural(count: number, singular: string, plural: string): string {
  return pluralRules.select(count) === "one" ? singular : plural;
}
